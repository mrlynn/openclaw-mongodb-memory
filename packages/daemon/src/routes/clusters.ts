/**
 * Clusters API Routes
 * 
 * Endpoints for managing semantic clusters and cluster-aware retrieval.
 */

import { Request, Response } from "express";
import { Db } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { runClustering } from "../services/clusteringService.js";

const COLLECTION_CLUSTERS = "clusters";
const COLLECTION_MEMORIES = "memories";

/**
 * POST /clusters/run
 * 
 * Trigger clustering job (recompute all clusters)
 */
export const runClusteringRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.body.agentId as string;
  const k = parseInt(req.body.k as string) || 20;

  if (!agentId) {
    res.status(400).json({ error: "agentId required in request body" });
    return;
  }

  const db: Db = req.app.locals.db;

  console.log(`[Clustering] Starting clustering for agent ${agentId} with k=${k}`);

  const result = await runClustering(db, agentId, k);

  res.json({
    success: true,
    message: "Clustering complete",
    clusters: result.clusters,
    memoriesAssigned: result.assigned,
  });
});

/**
 * GET /clusters
 * 
 * List all clusters for an agent
 */
export const listClustersRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.query.agentId as string;
  const sortBy = (req.query.sortBy as string) || "memberCount"; // memberCount | avgConfidence | label

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_CLUSTERS);

  const clusters = await collection
    .find({ agentId })
    .sort({ [sortBy]: sortBy === "label" ? 1 : -1 })
    .toArray();

  res.json({
    success: true,
    count: clusters.length,
    clusters: clusters.map((c) => ({
      id: c._id!.toString(),
      clusterId: c.clusterId,
      label: c.label,
      memberCount: c.memberCount,
      avgConfidence: c.avgConfidence,
      avgStrength: c.avgStrength,
      topEntities: c.topEntities,
      sampleTexts: c.sampleTexts,
      lastUpdatedAt: c.lastUpdatedAt,
    })),
  });
});

/**
 * GET /clusters/:clusterId
 * 
 * Get a single cluster with member memories
 */
export const getClusterRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const clusterId = req.params.clusterId;
  const agentId = req.query.agentId as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const clustersCollection = db.collection(COLLECTION_CLUSTERS);
  const memoriesCollection = db.collection(COLLECTION_MEMORIES);

  const cluster = await clustersCollection.findOne({ agentId, clusterId });

  if (!cluster) {
    res.status(404).json({ error: "Cluster not found" });
    return;
  }

  // Get member memories
  const members = await memoriesCollection
    .find({ agentId, clusterId })
    .sort({ confidence: -1, createdAt: -1 })
    .limit(limit)
    .toArray();

  res.json({
    success: true,
    cluster: {
      id: cluster._id!.toString(),
      clusterId: cluster.clusterId,
      label: cluster.label,
      memberCount: cluster.memberCount,
      avgConfidence: cluster.avgConfidence,
      avgStrength: cluster.avgStrength,
      topEntities: cluster.topEntities,
      sampleTexts: cluster.sampleTexts,
      createdAt: cluster.createdAt,
      lastUpdatedAt: cluster.lastUpdatedAt,
      members: members.map((m) => ({
        id: m._id!.toString(),
        text: m.text,
        confidence: m.confidence,
        strength: m.strength,
        memoryType: m.memoryType,
        createdAt: m.createdAt,
        tags: m.tags,
      })),
    },
  });
});

/**
 * GET /clusters/stats
 * 
 * Get clustering statistics for an agent
 */
export const getClusterStatsRoute = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const agentId = req.query.agentId as string;

  if (!agentId) {
    res.status(400).json({ error: "agentId query parameter required" });
    return;
  }

  const db: Db = req.app.locals.db;
  const clustersCollection = db.collection(COLLECTION_CLUSTERS);
  const memoriesCollection = db.collection(COLLECTION_MEMORIES);

  const totalClusters = await clustersCollection.countDocuments({ agentId });
  const totalMemories = await memoriesCollection.countDocuments({ agentId });
  const clusteredMemories = await memoriesCollection.countDocuments({
    agentId,
    clusterId: { $exists: true },
  });

  const clusters = await clustersCollection.find({ agentId }).toArray();

  res.json({
    success: true,
    stats: {
      totalClusters,
      totalMemories,
      clusteredMemories,
      clusteringPercentage:
        totalMemories > 0 ? ((clusteredMemories / totalMemories) * 100).toFixed(1) : "0.0",
      avgClusterSize:
        totalClusters > 0 ? (clusteredMemories / totalClusters).toFixed(1) : "0.0",
      largestCluster: clusters.length > 0 ? Math.max(...clusters.map((c) => c.memberCount)) : 0,
      smallestCluster: clusters.length > 0 ? Math.min(...clusters.map((c) => c.memberCount)) : 0,
    },
  });
});
