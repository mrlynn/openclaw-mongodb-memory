import { Request, Response } from "express";
import { MongoClient } from "mongodb";

export const statusRoute = async (req: Request, res: Response) => {
  try {
    const mongoClient: MongoClient = req.app.locals.mongoClient;

    // Check MongoDB connection
    const db = mongoClient.db("openclaw_memory");
    const collection = db.collection("memories");
    const count = await collection.countDocuments();

    res.json({
      success: true,
      daemon: "ready",
      mongodb: "connected",
      voyage: "ready",
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      stats: {
        totalMemories: count,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
};
