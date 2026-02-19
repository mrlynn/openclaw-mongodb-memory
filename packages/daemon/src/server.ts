import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import { rememberRoute } from "./routes/remember";
import { recallRoute } from "./routes/recall";
import { forgetRoute } from "./routes/forget";
import { statusRoute } from "./routes/status";
import { connectDatabase } from "./db";

// Load .env from root of monorepo
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = process.env.MEMORY_DAEMON_PORT || 7654;
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

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

// Start server
const startServer = async () => {
  try {
    // Verify Voyage API key
    if (!VOYAGE_API_KEY) {
      throw new Error("VOYAGE_API_KEY environment variable not set");
    }
    console.log("✓ Voyage API key configured");

    // Connect to MongoDB and initialize schema
    const db = await connectDatabase({ mongoUri: MONGO_URI });
    console.log("✓ Connected to MongoDB at", MONGO_URI);

    // Store in app locals for route access
    app.locals.mongoClient = db.client;
    app.locals.voyageApiKey = VOYAGE_API_KEY;

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
