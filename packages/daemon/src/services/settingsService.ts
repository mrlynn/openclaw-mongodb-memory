/**
 * Settings Service
 *
 * CRUD + resolution logic for per-agent semantic/LLM settings.
 * Settings are stored in the `settings` MongoDB collection.
 *
 * Resolution chain:
 *   1. Agent-specific per-stage toggles (highest priority)
 *   2. Agent-specific semanticLevel expansion
 *   3. Global (_global) per-stage toggles
 *   4. Global semanticLevel expansion
 *   5. DaemonConfig env vars / schema defaults
 */

import { Db } from "mongodb";
import { COLLECTION_SETTINGS } from "../constants.js";
import { DaemonConfig } from "../config.js";
import {
  AgentSettings,
  AgentSettingsSchema,
  AgentSettingsInput,
  ResolvedPipelineSettings,
  ResolvedStageConfig,
  EnhanceableStage,
  ENHANCEABLE_STAGES,
  SEMANTIC_LEVEL_MAP,
  GLOBAL_SETTINGS_ID,
  DEFAULT_LLM_ENDPOINT,
  DEFAULT_LLM_MODEL,
} from "../types/settings.js";

/**
 * Get raw settings document for an agent (or null if none stored).
 */
export async function getSettingsDoc(db: Db, agentId: string): Promise<AgentSettings | null> {
  const doc = await db.collection(COLLECTION_SETTINGS).findOne({ agentId });
  if (!doc) return null;
  // Validate through Zod to apply defaults for any missing fields
  return AgentSettingsSchema.parse(doc);
}

/**
 * Get fully resolved pipeline settings for an agent.
 * Merges: agent doc > global doc > DaemonConfig defaults.
 */
export async function getResolvedSettings(
  db: Db,
  agentId: string,
  daemonConfig: DaemonConfig,
): Promise<ResolvedPipelineSettings> {
  const agentDoc = await getSettingsDoc(db, agentId);
  const globalDoc =
    agentId !== GLOBAL_SETTINGS_ID ? await getSettingsDoc(db, GLOBAL_SETTINGS_ID) : null;

  return resolveSettings(agentDoc, globalDoc, daemonConfig);
}

/**
 * Pure resolution logic (testable without DB).
 */
export function resolveSettings(
  agentDoc: AgentSettings | null,
  globalDoc: AgentSettings | null,
  daemonConfig: DaemonConfig,
): ResolvedPipelineSettings {
  // Resolve LLM provider: agent > global > env vars > defaults
  const agentProvider = agentDoc?.llmProvider;
  const globalProvider = globalDoc?.llmProvider;

  const llmProvider = {
    endpoint:
      agentProvider?.endpoint ||
      globalProvider?.endpoint ||
      daemonConfig.llmEndpoint ||
      DEFAULT_LLM_ENDPOINT,
    model:
      agentProvider?.model || globalProvider?.model || daemonConfig.llmModel || DEFAULT_LLM_MODEL,
    apiKey: agentProvider?.apiKey || globalProvider?.apiKey || daemonConfig.llmApiKey,
    temperature: agentProvider?.temperature ?? globalProvider?.temperature ?? 0.3,
    maxTokens: agentProvider?.maxTokens ?? globalProvider?.maxTokens ?? 512,
    timeoutMs: agentProvider?.timeoutMs ?? globalProvider?.timeoutMs ?? 15000,
  };

  // Resolve per-stage toggles
  const stages = {} as Record<EnhanceableStage, ResolvedStageConfig>;

  // Start with global semanticLevel expansion (or all-off default)
  const globalLevel = globalDoc?.semanticLevel ?? "off";
  const globalLevelMap = SEMANTIC_LEVEL_MAP[globalLevel];

  // Override with agent semanticLevel expansion
  const agentLevel = agentDoc?.semanticLevel ?? globalLevel;
  const agentLevelMap = SEMANTIC_LEVEL_MAP[agentLevel];

  for (const stage of ENHANCEABLE_STAGES) {
    // Start from global level expansion
    let useLlm = globalLevelMap[stage];

    // Apply global per-stage override if explicitly set in the doc
    if (globalDoc?.stages?.[stage]) {
      useLlm = globalDoc.stages[stage].useLlm;
    }

    // Apply agent level expansion (overwrites global)
    if (agentDoc) {
      useLlm = agentLevelMap[stage];
    }

    // Apply agent per-stage override (highest priority)
    if (agentDoc?.stages?.[stage]) {
      useLlm = agentDoc.stages[stage].useLlm;
    }

    stages[stage] = { useLlm };
  }

  return { stages, llmProvider };
}

/**
 * Upsert settings for an agent (or _global).
 */
export async function upsertSettings(
  db: Db,
  agentId: string,
  input: AgentSettingsInput,
): Promise<AgentSettings> {
  const now = new Date();
  const collection = db.collection(COLLECTION_SETTINGS);

  const existing = await collection.findOne({ agentId });

  if (existing) {
    // Deep merge: only update fields that are provided
    const update: Record<string, unknown> = { updatedAt: now };

    if (input.semanticLevel !== undefined) {
      update.semanticLevel = input.semanticLevel;
    }
    if (input.stages) {
      for (const [stage, config] of Object.entries(input.stages)) {
        if (config && typeof config.useLlm === "boolean") {
          update[`stages.${stage}.useLlm`] = config.useLlm;
        }
      }
    }
    if (input.llmProvider) {
      for (const [key, value] of Object.entries(input.llmProvider)) {
        if (value !== undefined) {
          update[`llmProvider.${key}`] = value;
        }
      }
    }

    await collection.updateOne({ agentId }, { $set: update });
  } else {
    // Insert new document
    const doc = AgentSettingsSchema.parse({
      agentId,
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    await collection.insertOne(doc as any);
  }

  // Return the full resolved document
  const result = await collection.findOne({ agentId });
  return AgentSettingsSchema.parse(result);
}

/**
 * Delete agent-specific settings (revert to global defaults).
 * Cannot delete _global.
 */
export async function deleteSettings(db: Db, agentId: string): Promise<boolean> {
  if (agentId === GLOBAL_SETTINGS_ID) {
    return false;
  }
  const result = await db.collection(COLLECTION_SETTINGS).deleteOne({ agentId });
  return result.deletedCount > 0;
}
