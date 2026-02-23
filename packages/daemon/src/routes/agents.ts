import { Request, Response } from "express";
import { Db } from "mongodb";
import { COLLECTION_MEMORIES } from "../constants";

/**
 * GET /agents
 * Returns list of all unique agent IDs with memory count for each
 */
export async function handleAgents(req: Request, res: Response) {
  try {
    const db: Db = req.app.locals.db;
    const collection = db.collection(COLLECTION_MEMORIES);

    // Aggregate to get unique agent IDs with counts
    const agents = await collection
      .aggregate([
        {
          $group: {
            _id: "$agentId",
            count: { $sum: 1 },
            lastUpdated: { $max: "$timestamp" },
          },
        },
        {
          $project: {
            _id: 0,
            agentId: "$_id",
            count: 1,
            lastUpdated: 1,
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .toArray();

    res.json({
      success: true,
      count: agents.length,
      agents,
    });
  } catch (error: any) {
    console.error("Error fetching agents:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
