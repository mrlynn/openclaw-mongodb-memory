/**
 * Stage 8: Graph-Link
 *
 * Emits preliminary edges between related atoms for Phase 3 graph construction.
 * Creates edge candidates in a pending queue (not auto-created on memories yet).
 *
 * Two modes:
 *   - Heuristic (default): DERIVES_FROM, PRECEDES, CO_OCCURS (cosine), CONTRADICTS.
 *   - LLM-enhanced: Additionally discovers semantic edges (CAUSES, SUPPORTS, etc.)
 *     that cosine similarity alone would miss. LLM edges are additive.
 */

import { Db } from "mongodb";
import { PipelineStage, PipelineContext } from "../types.js";
import { Memory, GraphEdgeType } from "../../types/index.js";
import { VoyageEmbedder } from "../../embedding.js";
import { COLLECTION_MEMORIES } from "../../constants.js";
import { callLlmJson, getLlmConfig } from "../../services/llmClient.js";

const COLLECTION_PENDING_EDGES = "pending_edges";

const CO_OCCURS_THRESHOLD = 0.85;

interface PendingEdge {
  _id?: string;
  sourceId: string;
  targetId: string;
  edgeType: GraphEdgeType;
  weight: number;
  probability: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

/** Shape returned by the LLM edge discovery prompt. */
interface LlmEdgeResult {
  edges: Array<{
    sourceIndex: number;
    targetIndex: number;
    edgeType: string;
    weight: number;
    reasoning: string;
  }>;
}

/**
 * Graph-Link stage — creates edge candidates for Phase 3
 */
export class GraphLinkStage implements PipelineStage {
  name = "graph-link";

  constructor(
    private db: Db,
    private embedder: VoyageEmbedder,
  ) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { classifiedAtoms, agentId, sessionId } = context;

    if (!classifiedAtoms || classifiedAtoms.length === 0) {
      console.log(`[GraphLink] No atoms to link`);
      context.stats.graph_link_processed = 0;
      return context;
    }

    const pendingEdges: PendingEdge[] = [];

    // === Heuristic edges (always run) ===

    // 1. DERIVES_FROM edges
    for (const atom of classifiedAtoms) {
      if (atom.sourceEpisodeId) {
        pendingEdges.push({
          sourceId: atom._id!.toString(),
          targetId: atom.sourceEpisodeId,
          edgeType: "DERIVES_FROM",
          weight: 1.0,
          probability: 1.0,
          createdAt: new Date(),
          metadata: { sessionId },
        });
      }
    }

    // 2. PRECEDES edges within same session
    if (sessionId && classifiedAtoms.length > 1) {
      for (let i = 0; i < classifiedAtoms.length - 1; i++) {
        pendingEdges.push({
          sourceId: classifiedAtoms[i]._id!.toString(),
          targetId: classifiedAtoms[i + 1]._id!.toString(),
          edgeType: "PRECEDES",
          weight: 0.8,
          probability: 0.85,
          createdAt: new Date(),
          metadata: { sessionId, sequenceIndex: i },
        });
      }
    }

    // 3. CO_OCCURS edges for semantically similar atoms with shared tags
    for (let i = 0; i < classifiedAtoms.length; i++) {
      for (let j = i + 1; j < classifiedAtoms.length; j++) {
        const atomA = classifiedAtoms[i];
        const atomB = classifiedAtoms[j];

        const sharedTags = atomA.tags.filter((tag) => atomB.tags.includes(tag));

        if (sharedTags.length > 0) {
          const similarity = this.cosineSimilarity(atomA.embedding, atomB.embedding);

          if (similarity >= CO_OCCURS_THRESHOLD) {
            pendingEdges.push({
              sourceId: atomA._id!.toString(),
              targetId: atomB._id!.toString(),
              edgeType: "CO_OCCURS",
              weight: similarity,
              probability: 0.75,
              createdAt: new Date(),
              metadata: { sharedTags, similarity, sessionId },
            });
          }
        }
      }
    }

    // 4. CONTRADICTS edges
    for (const atom of classifiedAtoms) {
      if (atom.contradictions && atom.contradictions.length > 0) {
        for (const contradiction of atom.contradictions) {
          pendingEdges.push({
            sourceId: atom._id!.toString(),
            targetId: contradiction.memoryId.toString(),
            edgeType: "CONTRADICTS",
            weight: 0.9,
            probability: 0.8,
            createdAt: new Date(),
            metadata: { detectedAt: contradiction.detectedAt, sessionId },
          });
        }
      }
    }

    // === LLM-enhanced edge discovery (additive) ===
    const useLlm = context.resolvedSettings?.stages?.graphLink?.useLlm ?? false;

    if (useLlm && classifiedAtoms.length >= 2) {
      try {
        const llmEdges = await this.discoverEdgesLlm(context, classifiedAtoms);
        pendingEdges.push(...llmEdges);
        context.stats.graph_link_llm_edges = llmEdges.length;
        context.stats.graph_link_llm_used = 1;
        console.log(`[GraphLink] LLM discovered ${llmEdges.length} additional edges`);
      } catch (error) {
        console.warn(`[GraphLink] LLM edge discovery failed:`, error);
        context.stats.graph_link_llm_used = 0;
      }
    }

    // Store pending edges
    if (pendingEdges.length > 0) {
      const collection = this.db.collection<PendingEdge>(COLLECTION_PENDING_EDGES);
      await collection.insertMany(pendingEdges as any);
      console.log(`[GraphLink] Created ${pendingEdges.length} pending edge candidates`);
    }

    context.stats.graph_link_processed = classifiedAtoms.length;
    context.stats.graph_link_edges_created = pendingEdges.length;
    context.stats.graph_link_derives_from = pendingEdges.filter(
      (e) => e.edgeType === "DERIVES_FROM",
    ).length;
    context.stats.graph_link_precedes = pendingEdges.filter(
      (e) => e.edgeType === "PRECEDES",
    ).length;
    context.stats.graph_link_co_occurs = pendingEdges.filter(
      (e) => e.edgeType === "CO_OCCURS",
    ).length;
    context.stats.graph_link_contradicts = pendingEdges.filter(
      (e) => e.edgeType === "CONTRADICTS",
    ).length;

    return context;
  }

  /**
   * LLM-enhanced edge discovery — finds semantic relationships cosine can't detect.
   */
  private async discoverEdgesLlm(
    context: PipelineContext,
    atoms: Memory[],
  ): Promise<PendingEdge[]> {
    const config = getLlmConfig(context.resolvedSettings);

    const atomList = atoms
      .map((a, i) => `[${i}] "${a.text}" (type: ${a.memoryType}, tags: ${a.tags.join(", ")})`)
      .join("\n");

    const prompt = `You are a knowledge graph system. Analyze the following memory atoms and discover semantic relationships between them.

Valid edge types: CAUSES, SUPPORTS, CONTEXT_OF, SUPERSEDES, ELABORATES
(Do NOT output CONTRADICTS, CO_OCCURS, PRECEDES, or DERIVES_FROM — those are handled separately.)

For each relationship, provide:
- sourceIndex: Index of the source atom
- targetIndex: Index of the target atom
- edgeType: One of the valid types above
- weight: 0.0-1.0 (relationship strength)
- reasoning: Brief explanation (1 sentence)

Return ONLY JSON: {"edges": [...]}. Return {"edges": []} if no semantic relationships found.

Atoms:
${atomList}`;

    const { data } = await callLlmJson<LlmEdgeResult>(prompt, config);

    if (!data.edges || !Array.isArray(data.edges)) {
      return [];
    }

    const validTypes = new Set(["CAUSES", "SUPPORTS", "CONTEXT_OF", "SUPERSEDES", "ELABORATES"]);

    return data.edges
      .filter(
        (e) =>
          typeof e.sourceIndex === "number" &&
          typeof e.targetIndex === "number" &&
          e.sourceIndex >= 0 &&
          e.sourceIndex < atoms.length &&
          e.targetIndex >= 0 &&
          e.targetIndex < atoms.length &&
          e.sourceIndex !== e.targetIndex &&
          validTypes.has(e.edgeType),
      )
      .map((e) => ({
        sourceId: atoms[e.sourceIndex]._id!.toString(),
        targetId: atoms[e.targetIndex]._id!.toString(),
        edgeType: e.edgeType as GraphEdgeType,
        weight: typeof e.weight === "number" ? Math.max(0, Math.min(1, e.weight)) : 0.7,
        probability: 0.65, // LLM-suggested edges get moderate probability
        createdAt: new Date(),
        metadata: {
          source: "llm",
          reasoning: e.reasoning,
          sessionId: context.sessionId,
        },
      }));
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }
}
