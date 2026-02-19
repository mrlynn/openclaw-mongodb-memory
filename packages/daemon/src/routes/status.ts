import { Request, Response } from "express";

export const statusRoute = async (req: Request, res: Response) => {
  try {
    // TODO: Get stats from MongoDB
    
    res.json({
      success: true,
      daemon: "ready",
      mongodb: "connected",
      voyage: "ready",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
};
