import { Request, Response } from "express";
import { z } from "zod";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";

const TimelineSchema = z.object({
  agentId: z.string().min(1),
  days: z.coerce.number().int().positive().max(365).default(90),
});

/**
 * GET /timeline?agentId=X&days=90
 *
 * Returns a day-by-day count of memories created within the given time window.
 * Designed for GitHub-style activity heatmap visualization.
 */
export const timelineRoute = asyncHandler(
  async (req: Request, res: Response) => {
    const data = TimelineSchema.parse(req.query);

    const db: Db = req.app.locals.db;
    const collection = db.collection(COLLECTION_MEMORIES);

    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - data.days);
    fromDate.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          agentId: data.agentId,
          createdAt: { $gte: fromDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 as const },
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          count: 1,
        },
      },
    ];

    const days = await collection.aggregate(pipeline).toArray();

    const total = days.reduce(
      (sum, d) => sum + (d.count as number),
      0,
    );

    // Format dates for the date range
    const toDateStr = now.toISOString().slice(0, 10);
    const fromDateStr = fromDate.toISOString().slice(0, 10);

    res.json({
      success: true,
      agentId: data.agentId,
      days,
      total,
      dateRange: {
        from: fromDateStr,
        to: toDateStr,
      },
    });
  },
);
