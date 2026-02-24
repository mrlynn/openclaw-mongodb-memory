/**
 * Stage 9: Entity-Update
 *
 * Extracts entities (people, projects, systems, concepts) from memories
 * and maintains entity hub documents for Phase 3 graph construction.
 *
 * Two modes:
 *   - Heuristic (default): Capitalized-word extraction + tag-based hints.
 *   - LLM-enhanced: LLM performs NER with alias detection and entity summaries.
 */

import { Db } from "mongodb";
import { PipelineStage, PipelineContext } from "../types.js";
import { VoyageEmbedder } from "../../embedding.js";
import { Memory } from "../../types/index.js";
import { callLlmJson, getLlmConfig } from "../../services/llmClient.js";

const COLLECTION_ENTITIES = "entities";
const COLLECTION_PENDING_EDGES = "pending_edges";

/**
 * Entity document (Phase 3 schema)
 */
interface Entity {
  _id?: string;
  agentId: string;
  slug: string;
  type: "person" | "project" | "system" | "concept" | "place";
  displayName: string;
  aliases: string[];
  summary: string;
  summaryEmbedding: number[];
  attributes: Record<string, any>;
  memoryCount: number;
  lastSeenAt: Date;
  createdAt: Date;
}

interface EntityMention {
  slug: string;
  displayName: string;
  type: "person" | "project" | "system" | "concept" | "place";
  aliases: string[];
}

/** Shape returned by the LLM NER prompt. */
interface LlmEntityResult {
  entities: Array<{
    displayName: string;
    type: "person" | "project" | "system" | "concept" | "place";
    aliases?: string[];
    summary?: string;
  }>;
}

/**
 * Entity-Update stage — entity extraction and hub maintenance
 */
export class EntityUpdateStage implements PipelineStage {
  name = "entity-update";

  constructor(
    private db: Db,
    private embedder: VoyageEmbedder,
  ) {}

  async execute(context: PipelineContext): Promise<PipelineContext> {
    const { classifiedAtoms, agentId } = context;

    if (!classifiedAtoms || classifiedAtoms.length === 0) {
      console.log(`[EntityUpdate] No atoms to process`);
      context.stats.entity_update_processed = 0;
      return context;
    }

    const entitiesCollection = this.db.collection<Entity>(COLLECTION_ENTITIES);
    const pendingEdgesCollection = this.db.collection(COLLECTION_PENDING_EDGES);

    let entitiesCreated = 0;
    let entitiesUpdated = 0;
    let edgesCreated = 0;

    const useLlm = context.resolvedSettings?.stages?.entityUpdate?.useLlm ?? false;

    for (const atom of classifiedAtoms) {
      let mentions: EntityMention[];

      if (useLlm) {
        try {
          mentions = await this.extractEntitiesLlm(context, atom, agentId);
          context.stats.entity_update_llm_used = (context.stats.entity_update_llm_used || 0) + 1;
        } catch (error) {
          console.warn(`[EntityUpdate] LLM NER failed for atom, using heuristic:`, error);
          mentions = this.extractEntityMentions(atom.text, atom.tags);
        }
      } else {
        mentions = this.extractEntityMentions(atom.text, atom.tags);
      }

      for (const mention of mentions) {
        // Find or create entity
        const existingEntity = await entitiesCollection.findOne({
          agentId,
          slug: mention.slug,
        });

        if (existingEntity) {
          await entitiesCollection.updateOne(
            { _id: existingEntity._id },
            {
              $inc: { memoryCount: 1 },
              $set: { lastSeenAt: new Date() },
              $addToSet: { aliases: { $each: mention.aliases } },
            },
          );
          entitiesUpdated++;
        } else {
          const summary = `${mention.displayName} (${mention.type})`;
          context.usageTracker?.pushContext({
            operation: "reflect:entity-update",
            agentId,
            pipelineJobId: context.jobId,
            pipelineStage: "entity-update",
          });
          let summaryEmbedding: number[];
          try {
            summaryEmbedding = await this.embedder.embedOne(summary, "document");
          } finally {
            context.usageTracker?.popContext();
          }

          const newEntity: Omit<Entity, "_id"> = {
            agentId,
            slug: mention.slug,
            type: mention.type,
            displayName: mention.displayName,
            aliases: mention.aliases,
            summary,
            summaryEmbedding,
            attributes: {},
            memoryCount: 1,
            lastSeenAt: new Date(),
            createdAt: new Date(),
          };

          await entitiesCollection.insertOne(newEntity as any);
          entitiesCreated++;

          console.log(`[EntityUpdate] Created entity: ${mention.displayName} (${mention.type})`);
        }

        // Create MENTIONS_ENTITY edge
        await pendingEdgesCollection.insertOne({
          sourceId: atom._id!.toString(),
          targetId: mention.slug,
          edgeType: "MENTIONS_ENTITY",
          weight: 1.0,
          probability: 0.95,
          createdAt: new Date(),
          metadata: {
            entityType: mention.type,
            displayName: mention.displayName,
          },
        });
        edgesCreated++;
      }
    }

    context.stats.entity_update_processed = classifiedAtoms.length;
    context.stats.entity_update_created = entitiesCreated;
    context.stats.entity_update_updated = entitiesUpdated;
    context.stats.entity_update_edges_created = edgesCreated;

    console.log(
      `[EntityUpdate] Entities: ${entitiesCreated} created, ${entitiesUpdated} updated, ` +
        `${edgesCreated} MENTIONS_ENTITY edges created`,
    );

    return context;
  }

  /**
   * LLM-enhanced NER — identifies entities with types and aliases.
   */
  private async extractEntitiesLlm(
    context: PipelineContext,
    atom: Memory,
    agentId: string,
  ): Promise<EntityMention[]> {
    const config = getLlmConfig(context.resolvedSettings);

    // Load existing entities so LLM can merge rather than duplicate
    const existingEntities = await this.db
      .collection<Entity>(COLLECTION_ENTITIES)
      .find({ agentId })
      .project({ displayName: 1, slug: 1, type: 1, aliases: 1 })
      .limit(50)
      .toArray();

    const existingList =
      existingEntities.length > 0
        ? `\nExisting entities (merge with these if applicable):\n${existingEntities.map((e) => `- ${e.displayName} (${e.type}) [slug: ${e.slug}]`).join("\n")}`
        : "";

    const prompt = `You are a named entity recognition system. Extract all entities (people, projects, systems, concepts, places) from the following memory text.

For each entity provide:
- displayName: The canonical name
- type: One of "person", "project", "system", "concept", "place"
- aliases: Other names or abbreviations for the same entity (empty array if none)

Return ONLY a JSON object: {"entities": [...]}.  Return {"entities": []} if no entities found.
${existingList}

Memory text: "${atom.text}"
Tags: ${atom.tags.join(", ")}`;

    const { data } = await callLlmJson<LlmEntityResult>(prompt, config);

    if (!data.entities || !Array.isArray(data.entities)) {
      return [];
    }

    const seen = new Set<string>();
    return data.entities
      .filter((e) => e.displayName && e.type)
      .map((e) => ({
        slug: e.displayName.toLowerCase().replace(/\s+/g, "-"),
        displayName: e.displayName,
        type: e.type,
        aliases: [...(e.aliases || []), e.displayName],
      }))
      .filter((m) => {
        if (seen.has(m.slug)) return false;
        seen.add(m.slug);
        return true;
      });
  }

  /**
   * Heuristic-based entity extraction (simple pattern matching)
   */
  private extractEntityMentions(text: string, tags: string[]): EntityMention[] {
    const mentions: EntityMention[] = [];

    // Pattern 1: Capitalized words (potential proper nouns)
    const properNouns = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g) || [];

    for (const noun of properNouns) {
      if (["The", "This", "That", "I", "You", "We"].includes(noun)) continue;

      const slug = noun.toLowerCase().replace(/\s+/g, "-");
      let type: "person" | "project" | "system" | "concept" | "place" = "concept";

      if (noun.split(" ").length === 2) {
        type = "person";
      } else if (tags.includes("project") || noun.toLowerCase().includes("project")) {
        type = "project";
      } else if (tags.includes("system") || noun.toLowerCase().includes("system")) {
        type = "system";
      }

      mentions.push({ slug, displayName: noun, type, aliases: [noun] });
    }

    // Pattern 2: Tag-based entities
    for (const tag of tags) {
      if (
        ["fact", "preference", "decision", "auto-extracted", "llm-extracted", "noted"].includes(tag)
      )
        continue;
      if (tag !== tag.toLowerCase() || tag.includes("-")) {
        mentions.push({
          slug: tag.toLowerCase(),
          displayName: tag,
          type: "concept",
          aliases: [tag],
        });
      }
    }

    // Deduplicate by slug
    const seen = new Set<string>();
    return mentions.filter((m) => {
      if (seen.has(m.slug)) return false;
      seen.add(m.slug);
      return true;
    });
  }
}
