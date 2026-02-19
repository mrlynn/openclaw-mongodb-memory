import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import { rememberRoute } from "./routes/remember";
import { recallRoute } from "./routes/recall";
import { forgetRoute } from "./routes/forget";
import { statusRoute } from "./routes/status";
import { connectDatabase } from "./db";

// Load .env from root of monorepo
// __dirname = packages/daemon/src, so go up 3 levels to root
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const PORT = process.env.MEMORY_DAEMON_PORT || 7654;
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_BASE_URL = process.env.VOYAGE_BASE_URL; // Optional: MongoDB AI or custom endpoint
const VOYAGE_MODEL = process.env.VOYAGE_MODEL; // Optional: override default model

const app: Express = express();

// Middleware
app.use(express.json());

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.post("/remember", rememberRoute);
app.get("/recall", recallRoute);
app.delete("/forget/:id", forgetRoute);
app.get("/status", statusRoute);

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error"
  });
});

// Start server
const startServer = async () => {
  try {
    // Verify Voyage API key
    if (!VOYAGE_API_KEY) {
      throw new Error("VOYAGE_API_KEY environment variable not set");
    }
    
    // Show which Voyage endpoint we're using
    const voyageEndpoint = VOYAGE_BASE_URL || "https://api.voyageai.com/v1";
    const isMongoDB = VOYAGE_API_KEY.startsWith("al-");
    const endpointType = isMongoDB ? "MongoDB Atlas AI" : "Voyage.com";
    const isMock = process.env.VOYAGE_MOCK === "true";
    
    if (isMock) {
      console.log(`✓ Voyage API configured (MOCK MODE - for testing)`);
      console.log(`  Embeddings: Deterministic mocks based on text hash`);
      console.log(`  Note: Set VOYAGE_MOCK=false and provide valid API key to use real embeddings`);
    } else {
      console.log(`✓ Voyage API configured (Bearer token)`);
      console.log(`  Provider: ${endpointType}`);
      console.log(`  Endpoint: ${voyageEndpoint}`);
    }

    // Connect to MongoDB and initialize schema
    const db = await connectDatabase({ mongoUri: MONGO_URI });
    console.log("✓ Connected to MongoDB at", MONGO_URI);

    // Store in app locals for route access
    app.locals.mongoClient = db.client;
    app.locals.voyageApiKey = VOYAGE_API_KEY;
    app.locals.voyageBaseUrl = VOYAGE_BASE_URL;
    app.locals.voyageModel = VOYAGE_MODEL;

    // Start listening
    app.listen(PORT, () => {
      console.log(
        `🧠 Memory daemon listening on http://localhost:${PORT}`
      );
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      await db.client.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start daemon:", error);
    process.exit(1);
  }
};

startServer();
