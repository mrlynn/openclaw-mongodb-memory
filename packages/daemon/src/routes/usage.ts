/**
 * Usage & Cost API Routes
 *
 * Endpoints for querying token usage, cost breakdowns,
 * and projected spending. All data comes from the usage_events collection.
 */

import { Request, Response } from "express";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_USAGE_EVENTS, COLLECTION_MEMORIES } from "../constants";

/**
 * GET /usage/summary
 *
 * Aggregate usage stats over a time window.
 * Query params: ?days=30 &agentId=...
 */
export const usageSummaryRoute = asyncHandler(async (req: Request, res: Response) => {
  const db: Db = req.app.locals.db;
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const agentId = req.query.agentId as string | undefined;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match: Record<string, unknown> = { timestamp: { $gte: since } };
  if (agentId) match.agentId = agentId;

  const collection = db.collection(COLLECTION_USAGE_EVENTS);

  // Aggregate totals
  const [totals] = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: "$totalTokens" },
          totalCostUsd: { $sum: "$estimatedCostUsd" },
          totalCalls: { $sum: 1 },
          avgTokensPerCall: { $avg: "$totalTokens" },
        },
      },
    ])
    .toArray();

  // By operation
  const byOperation = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: "$operation",
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$estimatedCostUsd" },
          calls: { $sum: 1 },
        },
      },
      { $sort: { cost: -1 } },
    ])
    .toArray();

  // By model
  const byModel = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: "$model",
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$estimatedCostUsd" },
          calls: { $sum: 1 },
        },
      },
      { $sort: { cost: -1 } },
    ])
    .toArray();

  // Cost per memory
  const totalMemories = await db.collection(COLLECTION_MEMORIES).countDocuments(
    agentId ? { agentId } : {},
  );
  const totalCost = totals?.totalCostUsd || 0;

  const operationMap: Record<string, { tokens: number; cost: number; calls: number }> = {};
  for (const op of byOperation) {
    operationMap[op._id] = { tokens: op.tokens, cost: op.cost, calls: op.calls };
  }

  const modelMap: Record<string, { tokens: number; cost: number; calls: number }> = {};
  for (const m of byModel) {
    modelMap[m._id] = { tokens: m.tokens, cost: m.cost, calls: m.calls };
  }

  res.json({
    success: true,
    days,
    agentId: agentId || "all",
    totalTokens: totals?.totalTokens || 0,
    totalCostUsd: totalCost,
    totalCalls: totals?.totalCalls || 0,
    avgTokensPerCall: Math.round(totals?.avgTokensPerCall || 0),
    costPerMemory: totalMemories > 0 ? totalCost / totalMemories : 0,
    totalMemories,
    byOperation: operationMap,
    byModel: modelMap,
  });
});

/**
 * GET /usage/timeline
 *
 * Usage buckets over time for charting.
 * Query params: ?days=7 &granularity=hour|day &agentId=...
 */
export const usageTimelineRoute = asyncHandler(async (req: Request, res: Response) => {
  const db: Db = req.app.locals.db;
  const days = Math.min(parseInt(req.query.days as string) || 7, 90);
  const granularity = (req.query.granularity as string) === "hour" ? "hour" : "day";
  const agentId = req.query.agentId as string | undefined;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match: Record<string, unknown> = { timestamp: { $gte: since } };
  if (agentId) match.agentId = agentId;

  const collection = db.collection(COLLECTION_USAGE_EVENTS);

  const buckets = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$timestamp",
              unit: granularity,
            },
          },
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$estimatedCostUsd" },
          calls: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          tokens: 1,
          cost: 1,
          calls: 1,
        },
      },
    ])
    .toArray();

  res.json({
    success: true,
    days,
    granularity,
    agentId: agentId || "all",
    buckets,
  });
});

/**
 * GET /usage/by-agent
 *
 * Per-agent usage breakdown.
 * Query params: ?days=30
 */
export const usageByAgentRoute = asyncHandler(async (req: Request, res: Response) => {
  const db: Db = req.app.locals.db;
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const collection = db.collection(COLLECTION_USAGE_EVENTS);

  const agents = await collection
    .aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: "$agentId",
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$estimatedCostUsd" },
          calls: { $sum: 1 },
          lastActivity: { $max: "$timestamp" },
        },
      },
      { $sort: { cost: -1 } },
    ])
    .toArray();

  // Enrich with memory counts
  const enriched = await Promise.all(
    agents.map(async (a) => {
      const memoryCount = await db
        .collection(COLLECTION_MEMORIES)
        .countDocuments(a._id ? { agentId: a._id } : {});
      return {
        agentId: a._id || "unknown",
        tokens: a.tokens,
        cost: a.cost,
        calls: a.calls,
        memoryCount,
        costPerMemory: memoryCount > 0 ? a.cost / memoryCount : 0,
        lastActivity: a.lastActivity,
      };
    }),
  );

  res.json({
    success: true,
    days,
    agents: enriched,
  });
});

/**
 * GET /usage/pipeline-breakdown
 *
 * Cost breakdown by reflection pipeline stage.
 * Query params: ?days=30 &agentId=...
 */
export const usagePipelineRoute = asyncHandler(async (req: Request, res: Response) => {
  const db: Db = req.app.locals.db;
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const agentId = req.query.agentId as string | undefined;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const match: Record<string, unknown> = {
    timestamp: { $gte: since },
    pipelineStage: { $ne: null },
  };
  if (agentId) match.agentId = agentId;

  const collection = db.collection(COLLECTION_USAGE_EVENTS);

  const stages = await collection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: "$pipelineStage",
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$estimatedCostUsd" },
          calls: { $sum: 1 },
          avgTokensPerCall: { $avg: "$totalTokens" },
        },
      },
      { $sort: { cost: -1 } },
    ])
    .toArray();

  // Calculate total for percentages
  const totalTokens = stages.reduce((sum, s) => sum + s.tokens, 0);

  const stageList = stages.map((s) => ({
    stage: s._id,
    tokens: s.tokens,
    cost: s.cost,
    calls: s.calls,
    avgTokensPerCall: Math.round(s.avgTokensPerCall || 0),
    percentOfTotal: totalTokens > 0 ? Math.round((s.tokens / totalTokens) * 100 * 10) / 10 : 0,
  }));

  res.json({
    success: true,
    days,
    agentId: agentId || "all",
    totalPipelineTokens: totalTokens,
    stages: stageList,
  });
});

/**
 * GET /usage/projections
 *
 * Projected monthly cost based on rolling usage window.
 * Query params: ?days=7 (window to extrapolate from)
 */
export const usageProjectionsRoute = asyncHandler(async (req: Request, res: Response) => {
  const db: Db = req.app.locals.db;
  const days = Math.min(parseInt(req.query.days as string) || 7, 30);

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const collection = db.collection(COLLECTION_USAGE_EVENTS);

  // Get totals for the window
  const [totals] = await collection
    .aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: "$totalTokens" },
          totalCostUsd: { $sum: "$estimatedCostUsd" },
          totalCalls: { $sum: 1 },
        },
      },
    ])
    .toArray();

  // Get recall count for efficiency calculation
  const recallCount = await collection.countDocuments({
    timestamp: { $gte: since },
    operation: "recall",
  });

  // Get pipeline vs direct breakdown
  const [pipelineTotal] = await collection
    .aggregate([
      {
        $match: {
          timestamp: { $gte: since },
          pipelineStage: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          tokens: { $sum: "$totalTokens" },
          cost: { $sum: "$estimatedCostUsd" },
        },
      },
    ])
    .toArray();

  const totalMemories = await db.collection(COLLECTION_MEMORIES).countDocuments();

  const totalCost = totals?.totalCostUsd || 0;
  const totalTokens = totals?.totalTokens || 0;

  // Daily averages
  const dailyAvgCostUsd = totalCost / days;
  const dailyAvgTokens = totalTokens / days;

  // Monthly projection (30 days)
  const projectedMonthlyCostUsd = dailyAvgCostUsd * 30;
  const projectedMonthlyTokens = Math.round(dailyAvgTokens * 30);

  // Cost per memory
  const costPerMemory = totalMemories > 0 ? totalCost / totalMemories : 0;

  // Cost efficiency: recalls per dollar (higher = better)
  const costEfficiency = totalCost > 0 ? recallCount / totalCost : 0;

  // Reflection overhead ratio
  const reflectionCost = pipelineTotal?.cost || 0;
  const reflectionCostRatio = totalCost > 0 ? reflectionCost / totalCost : 0;

  res.json({
    success: true,
    windowDays: days,
    projectedMonthlyCostUsd,
    projectedMonthlyTokens,
    costPerMemory,
    costEfficiency: Math.round(costEfficiency),
    reflectionCostRatio: Math.round(reflectionCostRatio * 100) / 100,
    dailyAvgCostUsd,
    dailyAvgTokens: Math.round(dailyAvgTokens),
    totalMemories,
    recallsInWindow: recallCount,
  });
});
