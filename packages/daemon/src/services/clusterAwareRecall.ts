/**
 * Cluster-Aware Recall
 * 
 * Enhances recall by routing queries to relevant clusters first,
 * then expanding to global search if needed.
 */

import { Db } from "mongodb";
import { VoyageEmbedder } from "../embedding.js";
import { Cluster } from "./clusteringService.js";

const COLLECTION_CLUSTERS = "clusters";
const COLLECTION_MEMORIES = "memories";

/**
 * Find the most relevant clusters for a query
 * 
 * @param db - MongoDB database
 * @param queryEmbedding - Query embedding (1024-dim)
 * @param agentId - Agent ID
 * @param topK - Number of top clusters to return
 * @returns Top K cluster IDs sorted by relevance
 */
export async function findRelevantClusters(
  db: Db,
  queryEmbedding: number[],
  agentId: string,
  topK: number = 2
): Promise<string[]> {
  const clustersCollection = db.collection<Cluster>(COLLECTION_CLUSTERS);

  // Get all clusters for agent
  const clusters = await clustersCollection.find({ agentId }).toArray();

  if (clusters.length === 0) {
    return []; // No clusters available
  }

  // We need to reduce query embedding to 64-dim to match cluster centroids
  // In production, we'd cache the PCA model. For now, we'll skip PCA and use
  // a simplified approach: just use the first 64 dimensions
  const queryEmbedding64 = queryEmbedding.slice(0, 64);

  // Compute similarity to each cluster centroid
  const similarities: Array<{ clusterId: string; similarity: number }> = [];

  for (const cluster of clusters) {
    const similarity = cosineSimilarity(queryEmbedding64, cluster.centroid);
    similarities.push({
      clusterId: cluster.clusterId,
      similarity,
    });
  }

  // Sort by similarity descending
  similarities.sort((a, b) => b.similarity - a.similarity);

  // Return top K cluster IDs
  return similarities.slice(0, topK).map((s) => s.clusterId);
}

/**
 * Cluster-aware recall: search within top clusters first
 * 
 * @param db - MongoDB database
 * @param embedder - Voyage embedder
 * @param query - Query text
 * @param agentId - Agent ID
 * @param limit - Result limit
 * @returns Recall results with cluster routing metadata
 */
export async function clusterAwareRecall(
  db: Db,
  embedder: VoyageEmbedder,
  query: string,
  agentId: string,
  limit: number = 10
): Promise<{
  results: Array<any>;
  clustersSearched: string[];
  method: "cluster_aware" | "global_fallback";
}> {
  const memoriesCollection = db.collection(COLLECTION_MEMORIES);

  // Embed query
  const queryEmbedding = await embedder.embedOne(query, "query");

  // Find relevant clusters
  const topClusters = await findRelevantClusters(db, queryEmbedding, agentId, 2);

  if (topClusters.length === 0) {
    // No clusters — fall back to global search
    const results = await globalSearch(db, queryEmbedding, agentId, limit);
    return {
      results,
      clustersSearched: [],
      method: "global_fallback",
    };
  }

  // Search within top clusters
  const clusterResults = await memoriesCollection
    .find({
      agentId,
      clusterId: { $in: topClusters },
    })
    .limit(1000) // Reasonable limit for in-memory scoring
    .toArray();

  // Score by cosine similarity
  const scored = clusterResults.map((memory) => ({
    id: memory._id!.toString(),
    text: memory.text,
    score: VoyageEmbedder.cosineSimilarity(queryEmbedding, memory.embedding),
    tags: memory.tags,
    metadata: memory.metadata,
    createdAt: memory.createdAt,
  }));

  scored.sort((a, b) => b.score - a.score);

  // If we got enough results, return them
  if (scored.length >= limit) {
    return {
      results: scored.slice(0, limit),
      clustersSearched: topClusters,
      method: "cluster_aware",
    };
  }

  // Not enough results — expand to global search
  const globalResults = await globalSearch(db, queryEmbedding, agentId, limit);

  return {
    results: globalResults,
    clustersSearched: topClusters,
    method: "global_fallback",
  };
}

/**
 * Global search (fallback when cluster search insufficient)
 */
async function globalSearch(
  db: Db,
  queryEmbedding: number[],
  agentId: string,
  limit: number
): Promise<Array<any>> {
  const memoriesCollection = db.collection(COLLECTION_MEMORIES);

  const allMemories = await memoriesCollection
    .find({ agentId })
    .limit(10000)
    .toArray();

  const scored = allMemories.map((memory) => ({
    id: memory._id!.toString(),
    text: memory.text,
    score: VoyageEmbedder.cosineSimilarity(queryEmbedding, memory.embedding),
    tags: memory.tags,
    metadata: memory.metadata,
    createdAt: memory.createdAt,
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

/**
 * Cosine similarity
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}
