/**
 * Clustering Service
 * 
 * Performs semantic clustering on memory embeddings using PCA + K-Means.
 * Creates emergent topic clusters for cluster-aware retrieval.
 */

import { Db } from "mongodb";
import { COLLECTION_MEMORIES } from "../constants.js";
import { Memory } from "../types/index.js";

const COLLECTION_CLUSTERS = "clusters";

/**
 * Cluster document
 */
export interface Cluster {
  _id?: string;
  agentId: string;
  clusterId: string;
  label: string;
  centroid: number[]; // 64-dim PCA-reduced centroid
  memberCount: number;
  avgConfidence: number;
  avgStrength: number;
  topEntities: string[];
  sampleTexts: string[];
  createdAt: Date;
  lastUpdatedAt: Date;
}

/**
 * Run clustering on all memories for an agent
 * 
 * @param db - MongoDB database
 * @param agentId - Agent ID to cluster
 * @param k - Number of clusters (default: 20)
 * @returns Number of clusters created
 */
export async function runClustering(
  db: Db,
  agentId: string,
  k: number = 20
): Promise<{ clusters: number; assigned: number }> {
  const memoriesCollection = db.collection<Memory>(COLLECTION_MEMORIES);
  const clustersCollection = db.collection<Cluster>(COLLECTION_CLUSTERS);

  // 1. Load all memory embeddings
  const memories = await memoriesCollection
    .find({ agentId })
    .project({ _id: 1, embedding: 1, text: 1, tags: 1, confidence: 1, strength: 1 })
    .toArray();

  if (memories.length < k) {
    console.log(`[Clustering] Not enough memories (${memories.length} < ${k}), skipping`);
    return { clusters: 0, assigned: 0 };
  }

  // 2. Simple dimension reduction: 1024 → 64 (use first 64 dims)
  // In production, this would use proper PCA. For Phase 4 MVP, we use truncation.
  const embeddings1024 = memories.map((m) => m.embedding);
  const embeddings64 = embeddings1024.map((emb) => emb.slice(0, 64));

  console.log(`[Clustering] Dimension reduction: ${embeddings1024.length} embeddings reduced to 64 dims`);

  // 3. K-Means clustering
  const assignments = kMeans(embeddings64, k);

  console.log(`[Clustering] K-Means: ${k} clusters assigned`);

  // 4. Compute cluster centroids and metadata
  const clusterData: Map<number, { members: typeof memories; centroid: number[] }> = new Map();

  for (let i = 0; i < k; i++) {
    clusterData.set(i, { members: [], centroid: [] });
  }

  memories.forEach((memory, idx) => {
    const clusterId = assignments[idx];
    const cluster = clusterData.get(clusterId)!;
    cluster.members.push(memory);
  });

  // Compute centroids
  for (const [clusterId, data] of clusterData.entries()) {
    if (data.members.length === 0) continue;

    // Average of member embeddings
    const centroid = new Array(64).fill(0);
    data.members.forEach((m, idx) => {
      const embedding = embeddings64[memories.indexOf(m)];
      for (let d = 0; d < 64; d++) {
        centroid[d] += embedding[d];
      }
    });
    for (let d = 0; d < 64; d++) {
      centroid[d] /= data.members.length;
    }

    data.centroid = centroid;
  }

  // 5. Create/update cluster documents
  let clustersCreated = 0;

  for (const [clusterIdx, data] of clusterData.entries()) {
    if (data.members.length === 0) continue;

    const clusterId = `cluster_${String(clusterIdx).padStart(2, "0")}`;

    // Generate label from top members
    const label = generateClusterLabel(data.members);

    // Extract top entities
    const topEntities = extractTopEntities(data.members);

    // Sample texts
    const sampleTexts = data.members
      .slice(0, 3)
      .map((m) => m.text.slice(0, 100));

    // Compute averages
    const avgConfidence =
      data.members.reduce((sum, m) => sum + (m.confidence || 0.6), 0) / data.members.length;
    const avgStrength =
      data.members.reduce((sum, m) => sum + (m.strength || 1), 0) / data.members.length;

    const clusterDoc: Omit<Cluster, "_id"> = {
      agentId,
      clusterId,
      label,
      centroid: data.centroid,
      memberCount: data.members.length,
      avgConfidence,
      avgStrength,
      topEntities,
      sampleTexts,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
    };

    // Upsert cluster document
    await clustersCollection.updateOne(
      { agentId, clusterId },
      { $set: clusterDoc },
      { upsert: true }
    );

    clustersCreated++;

    // Assign clusterId to memories
    const memberIds = data.members.map((m) => m._id);
    await memoriesCollection.updateMany(
      { _id: { $in: memberIds as any } },
      {
        $set: {
          clusterId,
          clusterLabel: label,
          updatedAt: new Date(),
        },
      }
    );
  }

  console.log(`[Clustering] Created/updated ${clustersCreated} clusters`);

  return { clusters: clustersCreated, assigned: memories.length };
}

/**
 * Assign a new memory to nearest cluster
 * 
 * @param db - MongoDB database
 * @param memory - Memory to assign
 * @param embedding64 - PCA-reduced embedding (64-dim)
 */
export async function assignToNearestCluster(
  db: Db,
  memoryId: string,
  embedding64: number[]
): Promise<string | null> {
  const clustersCollection = db.collection<Cluster>(COLLECTION_CLUSTERS);

  // Find all clusters (we cache these in production)
  const clusters = await clustersCollection.find({}).toArray();

  if (clusters.length === 0) return null;

  // Find nearest cluster by cosine similarity
  let bestCluster: Cluster | null = null;
  let bestSimilarity = -1;

  for (const cluster of clusters) {
    const similarity = cosineSimilarity(embedding64, cluster.centroid);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestCluster = cluster;
    }
  }

  if (!bestCluster) return null;

  // Assign memory to cluster
  const { ObjectId } = await import("mongodb");
  const memoriesCollection = db.collection(COLLECTION_MEMORIES);

  await memoriesCollection.updateOne(
    { _id: new ObjectId(memoryId) as any },
    {
      $set: {
        clusterId: bestCluster.clusterId,
        clusterLabel: bestCluster.label,
        updatedAt: new Date(),
      },
    }
  );

  // Increment cluster member count
  await clustersCollection.updateOne(
    { _id: bestCluster._id },
    {
      $inc: { memberCount: 1 },
      $set: { lastUpdatedAt: new Date() },
    }
  );

  return bestCluster.clusterId;
}

/**
 * Simple K-Means implementation
 */
function kMeans(data: number[][], k: number, maxIter: number = 100): number[] {
  const n = data.length;
  const d = data[0].length;

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < k; i++) {
    let idx: number;
    do {
      idx = Math.floor(Math.random() * n);
    } while (usedIndices.has(idx));
    usedIndices.add(idx);
    centroids.push([...data[idx]]);
  }

  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    // Assign points to nearest centroid
    const newAssignments = new Array(n);

    for (let i = 0; i < n; i++) {
      let bestDist = Infinity;
      let bestCluster = 0;

      for (let c = 0; c < k; c++) {
        const dist = euclideanDistance(data[i], centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = c;
        }
      }

      newAssignments[i] = bestCluster;
    }

    // Check convergence
    if (JSON.stringify(newAssignments) === JSON.stringify(assignments)) {
      break;
    }

    assignments = newAssignments;

    // Recompute centroids
    const clusterSums: number[][] = Array(k)
      .fill(null)
      .map(() => new Array(d).fill(0));
    const clusterCounts = new Array(k).fill(0);

    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      clusterCounts[cluster]++;
      for (let j = 0; j < d; j++) {
        clusterSums[cluster][j] += data[i][j];
      }
    }

    for (let c = 0; c < k; c++) {
      if (clusterCounts[c] > 0) {
        for (let j = 0; j < d; j++) {
          centroids[c][j] = clusterSums[c][j] / clusterCounts[c];
        }
      }
    }
  }

  return assignments;
}

/**
 * Euclidean distance
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Cosine similarity
 */
function cosineSimilarity(a: number[], b: number[]): number {
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

/**
 * Generate cluster label from member texts (simple heuristic)
 * In production, this would use LLM to analyze top memories
 */
function generateClusterLabel(members: any[]): string {
  // Extract most common words from texts
  const words = new Map<string, number>();

  members.slice(0, 10).forEach((m) => {
    const text = m.text.toLowerCase();
    const tokens = text.match(/\b[a-z]{4,}\b/g) || [];

    tokens.forEach((word: string) => {
      // Skip common words
      if (["this", "that", "with", "from", "have", "been", "were", "they"].includes(word)) {
        return;
      }
      words.set(word, (words.get(word) || 0) + 1);
    });
  });

  // Top 2 words
  const topWords = Array.from(words.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map((e) => e[0]);

  return topWords.length > 0 ? topWords.join(" ") : "general";
}

/**
 * Extract top entities from cluster members
 */
function extractTopEntities(members: any[]): string[] {
  const entities = new Map<string, number>();

  members.forEach((m) => {
    (m.tags || []).forEach((tag: string) => {
      entities.set(tag, (entities.get(tag) || 0) + 1);
    });
  });

  return Array.from(entities.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((e) => e[0]);
}
