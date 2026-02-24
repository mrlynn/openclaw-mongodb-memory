/**
 * Graph Service
 *
 * Manages graph edges between memories and entities.
 * Applies pending edges from reflection pipeline to actual memory documents.
 */

import { Db, ObjectId } from "mongodb";
import { COLLECTION_MEMORIES } from "../constants.js";
import { Memory, GraphEdge, GraphEdgeType } from "../types/index.js";

const COLLECTION_PENDING_EDGES = "pending_edges";
const COLLECTION_ENTITIES = "entities";

/** Check if a string is a valid 24-char hex ObjectId */
function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Pending edge from reflection pipeline
 */
interface PendingEdge {
  _id: string;
  sourceId: string;
  targetId: string;
  edgeType: GraphEdgeType;
  weight: number;
  probability: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Apply a pending edge to a memory document
 */
export async function applyPendingEdge(
  db: Db,
  pendingEdgeId: string,
): Promise<{ success: boolean; error?: string }> {
  const pendingEdgesCollection = db.collection<PendingEdge>(COLLECTION_PENDING_EDGES);
  const memoriesCollection = db.collection<Memory>(COLLECTION_MEMORIES);

  // Get pending edge
  const pendingEdge = await pendingEdgesCollection.findOne({
    _id: new ObjectId(pendingEdgeId) as any,
  });

  if (!pendingEdge) {
    return { success: false, error: "Pending edge not found" };
  }

  // Verify source memory exists
  const sourceMemory = await memoriesCollection.findOne({
    _id: new ObjectId(pendingEdge.sourceId) as any,
  });

  if (!sourceMemory) {
    return { success: false, error: "Source memory not found" };
  }

  // Create edge object
  const edge: GraphEdge = {
    type: pendingEdge.edgeType,
    targetId: pendingEdge.targetId,
    weight: pendingEdge.weight,
    createdAt: new Date(),
    metadata: pendingEdge.metadata,
  };

  // Add edge to source memory
  await memoriesCollection.updateOne(
    { _id: new ObjectId(pendingEdge.sourceId) as any },
    {
      $push: { edges: edge as any },
      $set: { updatedAt: new Date() },
    },
  );

  // If bidirectional edge (CONTRADICTS, CO_OCCURS), add reverse edge
  if (pendingEdge.edgeType === "CONTRADICTS" || pendingEdge.edgeType === "CO_OCCURS") {
    const reverseEdge: GraphEdge = {
      type: pendingEdge.edgeType,
      targetId: pendingEdge.sourceId,
      weight: pendingEdge.weight,
      createdAt: new Date(),
      metadata: pendingEdge.metadata,
    };

    await memoriesCollection.updateOne(
      { _id: new ObjectId(pendingEdge.targetId) as any },
      {
        $push: { edges: reverseEdge as any },
        $set: { updatedAt: new Date() },
      },
    );
  }

  // Delete pending edge
  await pendingEdgesCollection.deleteOne({ _id: pendingEdge._id });

  return { success: true };
}

/**
 * Approve multiple pending edges (bulk operation)
 */
export async function approvePendingEdges(
  db: Db,
  edgeIds: string[],
): Promise<{ applied: number; failed: number }> {
  let applied = 0;
  let failed = 0;

  for (const edgeId of edgeIds) {
    const result = await applyPendingEdge(db, edgeId);
    if (result.success) {
      applied++;
    } else {
      failed++;
      console.error(`Failed to apply edge ${edgeId}:`, result.error);
    }
  }

  return { applied, failed };
}

/**
 * Reject a pending edge (delete without applying)
 */
export async function rejectPendingEdge(db: Db, edgeId: string): Promise<boolean> {
  const collection = db.collection(COLLECTION_PENDING_EDGES);
  const result = await collection.deleteOne({ _id: new ObjectId(edgeId) as any });
  return result.deletedCount > 0;
}

/**
 * List pending edges for review
 */
export async function listPendingEdges(
  db: Db,
  filters: {
    edgeType?: GraphEdgeType;
    minProbability?: number;
    limit?: number;
  } = {},
): Promise<PendingEdge[]> {
  const collection = db.collection<PendingEdge>(COLLECTION_PENDING_EDGES);

  const query: any = {};
  if (filters.edgeType) {
    query.edgeType = filters.edgeType;
  }
  if (filters.minProbability) {
    query.probability = { $gte: filters.minProbability };
  }

  return collection
    .find(query)
    .sort({ probability: -1, createdAt: -1 })
    .limit(filters.limit || 50)
    .toArray();
}

/**
 * Traverse graph from a starting memory
 *
 * Uses application-level BFS (not $graphLookup) for more control
 */
export async function traverseGraph(
  db: Db,
  startMemoryId: string,
  options: {
    edgeTypes?: GraphEdgeType[];
    direction?: "outbound" | "inbound" | "both";
    maxDepth?: number;
  } = {},
): Promise<{
  centerNode: Memory;
  connectedMemories: Array<{
    memory: Memory;
    relationship: GraphEdgeType;
    depth: number;
    path: string[];
  }>;
}> {
  const collection = db.collection<Memory>(COLLECTION_MEMORIES);

  const maxDepth = options.maxDepth || 2;
  const edgeTypes = options.edgeTypes;
  const direction = options.direction || "outbound";

  // Get center node
  if (!isValidObjectId(startMemoryId)) {
    throw new Error("Invalid memory ID format");
  }

  const centerNode = await collection.findOne({
    _id: new ObjectId(startMemoryId) as any,
  });

  if (!centerNode) {
    throw new Error("Start memory not found");
  }

  const visited = new Set<string>();
  const connectedMemories: Array<any> = [];

  // BFS queue: [memoryId, depth, path, edgeType]
  const queue: Array<[string, number, string[], GraphEdgeType | null]> = [
    [startMemoryId, 0, [], null],
  ];

  visited.add(startMemoryId);

  while (queue.length > 0) {
    const [currentId, depth, path, edgeType] = queue.shift()!;

    if (depth >= maxDepth) continue;

    const current = await collection.findOne({ _id: new ObjectId(currentId) as any });
    if (!current || !current.edges) continue;

    // Traverse outbound edges
    if (direction === "outbound" || direction === "both") {
      for (const edge of current.edges) {
        if (edgeTypes && !edgeTypes.includes(edge.type)) continue;

        // Skip non-ObjectId targets (e.g., entity slugs from MENTIONS_ENTITY edges)
        if (!isValidObjectId(edge.targetId)) continue;

        if (!visited.has(edge.targetId)) {
          visited.add(edge.targetId);

          const targetMemory = await collection.findOne({
            _id: new ObjectId(edge.targetId) as any,
          });

          if (targetMemory) {
            connectedMemories.push({
              memory: targetMemory,
              relationship: edge.type,
              depth: depth + 1,
              path: [...path, currentId],
            });

            queue.push([edge.targetId, depth + 1, [...path, currentId], edge.type]);
          }
        }
      }
    }

    // Traverse inbound edges (find memories that point to current)
    if (direction === "inbound" || direction === "both") {
      const inbound = await collection
        .find({
          "edges.targetId": currentId,
        })
        .toArray();

      for (const sourceMemory of inbound) {
        if (visited.has(sourceMemory._id!.toString())) continue;

        const relevantEdge = sourceMemory.edges?.find((e) => e.targetId === currentId);
        if (!relevantEdge) continue;
        if (edgeTypes && !edgeTypes.includes(relevantEdge.type)) continue;

        visited.add(sourceMemory._id!.toString());

        connectedMemories.push({
          memory: sourceMemory,
          relationship: relevantEdge.type,
          depth: depth + 1,
          path: [...path, currentId],
        });

        queue.push([
          sourceMemory._id!.toString(),
          depth + 1,
          [...path, currentId],
          relevantEdge.type,
        ]);
      }
    }
  }

  return {
    centerNode,
    connectedMemories,
  };
}
