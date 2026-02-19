import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { rememberRoute } from "./routes/remember";
import { recallRoute } from "./routes/recall";
import { forgetRoute } from "./routes/forget";
import { statusRoute } from "./routes/status";
import { exportRoute } from "./routes/export";
import { purgeRoute } from "./routes/purge";
import { clearRoute } from "./routes/clear";
import { healthRoute } from "./routes/health";
import { connectDatabase } from "./db";
import { VoyageEmbedder } from "./embedding";
import { DEFAULT_PORT, DEFAULT_MONGO_URI, MAX_REQUEST_BODY } from "./constants";

// Load .env from root of monorepo
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const PORT = process.env.MEMORY_DAEMON_PORT || DEFAULT_PORT;
const MONGO_URI = process.env.MONGODB_URI || DEFAULT_MONGO_URI;
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_BASE_URL = process.env.VOYAGE_BASE_URL;
const VOYAGE_MODEL = process.env.VOYAGE_MODEL;
const MEMORY_API_KEY = process.env.MEMORY_API_KEY;

const app = express();

// --- Middleware ---

app.use(cors());
app.use(express.json({ limit: MAX_REQUEST_BODY }));

// API key auth (if MEMORY_API_KEY is set, all routes except /health require it)
if (MEMORY_API_KEY) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/health") return next();

    const provided = req.headers["x-api-key"] as string | undefined;
    if (!provided || provided !== MEMORY_API_KEY) {
      res.status(401).json({ success: false, error: "Unauthorized: invalid or missing X-API-Key header" });
      return;
    }
    next();
  });
}

// --- Routes ---

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/health/detailed", healthRoute);

app.post("/remember", rememberRoute);
app.get("/recall", recallRoute);
app.delete("/forget/:id", forgetRoute);
app.get("/status", statusRoute);
app.get("/export", exportRoute);
app.post("/purge", purgeRoute);
app.delete("/clear", clearRoute);

// --- Global async-safe error handler ---

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// --- Startup ---

const startServer = async () => {
  try {
    if (!VOYAGE_API_KEY) {
      throw new Error("VOYAGE_API_KEY environment variable not set");
    }

    const isMock = process.env.VOYAGE_MOCK === "true";
    const voyageEndpoint = VOYAGE_BASE_URL || "https://api.voyageai.com/v1";
    const isMongoDB = VOYAGE_API_KEY.startsWith("al-");
    const endpointType = isMongoDB ? "MongoDB Atlas AI" : "Voyage.com";

    if (isMock) {
      console.log("✓ Voyage API configured (MOCK MODE - for testing)");
      console.log("  Embeddings: Deterministic mocks based on text hash");
    } else {
      console.log("✓ Voyage API configured (Bearer token)");
      console.log(`  Provider: ${endpointType}`);
      console.log(`  Endpoint: ${voyageEndpoint}`);
    }

    // Create singleton embedder — shared across all requests
    const embedder = new VoyageEmbedder(VOYAGE_API_KEY, VOYAGE_BASE_URL, VOYAGE_MODEL);

    // Connect to MongoDB
    const { client, db } = await connectDatabase({ mongoUri: MONGO_URI });
    console.log("✓ Connected to MongoDB");

    // Store shared resources for route access
    app.locals.db = db;
    app.locals.mongoClient = client;
    app.locals.embedder = embedder;

    if (MEMORY_API_KEY) {
      console.log("✓ API key auth enabled");
    } else {
      console.log("⚠ No MEMORY_API_KEY set — daemon is unauthenticated");
    }

    app.listen(PORT, () => {
      console.log(`🧠 Memory daemon listening on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      console.log("\nShutting down...");
      await client.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start daemon:", error);
    process.exit(1);
  }
};

startServer();
