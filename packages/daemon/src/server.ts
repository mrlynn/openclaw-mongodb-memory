import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import net from "net";
import { rememberRoute } from "./routes/remember";
import { recallRoute } from "./routes/recall";
import { forgetRoute } from "./routes/forget";
import { statusRoute } from "./routes/status";
import { exportRoute } from "./routes/export";
import { purgeRoute } from "./routes/purge";
import { clearRoute } from "./routes/clear";
import { healthRoute } from "./routes/health";
import { handleAgents } from "./routes/agents";
import { wordcloudRoute } from "./routes/wordcloud";
import { embeddingsRoute } from "./routes/embeddings";
import { timelineRoute } from "./routes/timeline";
import { memoriesRoute } from "./routes/memories";
import { setupCheckRoute } from "./routes/setupCheck";
import { restoreRoute } from "./routes/restore";
import { sourcesRoute } from "./routes/sources";
import { connectDatabase } from "./db";
import { VoyageEmbedder } from "./embedding";
import { MAX_REQUEST_BODY } from "./constants";
import { loadConfig } from "./config";
import { startupError } from "./utils/startupError";
import { getTier } from "./utils/tier";

// Load .env from root of monorepo, then package-level
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Validate all config up front
const config = loadConfig();

const app = express();

// --- Middleware ---

app.use(cors());
app.use(express.json({ limit: MAX_REQUEST_BODY }));

// API key auth (if MEMORY_API_KEY is set, all routes except /health require it)
if (config.memoryApiKey) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/health") return next();

    const provided = req.headers["x-api-key"] as string | undefined;
    if (!provided || provided !== config.memoryApiKey) {
      res
        .status(401)
        .json({ success: false, error: "Unauthorized: invalid or missing X-API-Key header" });
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
app.get("/health/setup", setupCheckRoute);
app.get("/agents", handleAgents);

app.post("/remember", rememberRoute);
app.get("/recall", recallRoute);
app.delete("/forget/:id", forgetRoute);
app.get("/status", statusRoute);
app.get("/export", exportRoute);
app.get("/wordcloud", wordcloudRoute);
app.get("/embeddings", embeddingsRoute);
app.get("/timeline", timelineRoute);
app.get("/memories", memoriesRoute);
app.post("/purge", purgeRoute);
app.delete("/clear", clearRoute);
app.post("/restore", express.json({ limit: "10mb" }), restoreRoute);
app.get("/sources", sourcesRoute);

// --- Global async-safe error handler ---

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

// --- Port availability check ---

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

// --- Startup ---

const startServer = async () => {
  try {
    // Check port availability
    const portFree = await isPortAvailable(config.port);
    if (!portFree) {
      startupError({
        title: `Port ${config.port} is already in use`,
        description: "Another process is already listening on this port.",
        fix: [
          `Find the process: lsof -i :${config.port}`,
          `Kill it: kill <PID>`,
          `Or change MEMORY_DAEMON_PORT in .env.local`,
        ],
      });
    }

    const voyageKey = config.voyageApiKey || "mock-key";
    const voyageEndpoint = config.voyageBaseUrl || "https://api.voyageai.com/v1";
    const isMongoDB = voyageKey.startsWith("al-");
    const endpointType = isMongoDB ? "MongoDB Atlas AI" : "Voyage.com";

    if (config.voyageMock) {
      console.log("  Voyage API configured (MOCK MODE - for testing)");
      console.log("  Embeddings: Deterministic mocks based on text hash");
    } else {
      console.log("  Voyage API configured (Bearer token)");
      console.log(`  Provider: ${endpointType}`);
      console.log(`  Endpoint: ${voyageEndpoint}`);
    }

    // Create singleton embedder — shared across all requests
    const embedder = new VoyageEmbedder(
      voyageKey,
      config.voyageBaseUrl,
      config.voyageModel,
      config.voyageMock,
    );

    // Connect to MongoDB
    const { client, db } = await connectDatabase({ mongoUri: config.mongoUri });
    console.log("  Connected to MongoDB");

    // Store shared resources for route access
    app.locals.db = db;
    app.locals.mongoClient = client;
    app.locals.embedder = embedder;
    app.locals.config = config;

    if (config.memoryApiKey) {
      console.log("  API key auth enabled");
    } else {
      console.log("  No MEMORY_API_KEY set — daemon is unauthenticated");
    }

    // Log degradation tier
    const tierInfo = getTier(config.voyageMock, false); // Vector index checked at runtime
    console.log(`  Tier: ${tierInfo.label} — ${tierInfo.description}`);

    app.listen(config.port, () => {
      console.log(`  Memory daemon listening on http://localhost:${config.port}`);
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

// Export for testing
export { app };
