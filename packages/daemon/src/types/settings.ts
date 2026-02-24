/**
 * Semantic/LLM Settings Types
 *
 * Per-agent (or global) configuration for which reflection stages
 * use LLM-enhanced semantic processing vs heuristics.
 *
 * Resolution priority:
 *   per-stage override > semanticLevel expansion > global defaults > env vars
 */

import { z } from "zod";

/**
 * Semantic level shortcut — sets all stage toggles at once.
 *   off:      all stages use heuristics
 *   basic:    extract uses LLM
 *   enhanced: extract + classify + entityUpdate use LLM
 *   full:     all 5 enhanceable stages use LLM
 */
export const SemanticLevelSchema = z.enum(["off", "basic", "enhanced", "full"]);
export type SemanticLevel = z.infer<typeof SemanticLevelSchema>;

/** Mapping from semantic level to per-stage toggles. */
export const SEMANTIC_LEVEL_MAP: Record<SemanticLevel, Record<EnhanceableStage, boolean>> = {
  off: {
    extract: false,
    classify: false,
    entityUpdate: false,
    graphLink: false,
    layerPromote: false,
  },
  basic: {
    extract: true,
    classify: false,
    entityUpdate: false,
    graphLink: false,
    layerPromote: false,
  },
  enhanced: {
    extract: true,
    classify: true,
    entityUpdate: true,
    graphLink: false,
    layerPromote: false,
  },
  full: { extract: true, classify: true, entityUpdate: true, graphLink: true, layerPromote: true },
};

/** The 5 stages that support LLM enhancement. */
export type EnhanceableStage =
  | "extract"
  | "classify"
  | "entityUpdate"
  | "graphLink"
  | "layerPromote";
export const ENHANCEABLE_STAGES: EnhanceableStage[] = [
  "extract",
  "classify",
  "entityUpdate",
  "graphLink",
  "layerPromote",
];

/** Per-stage LLM configuration. */
const StageSemanticConfigSchema = z.object({
  useLlm: z.boolean().default(false),
});
export type StageSemanticConfig = z.infer<typeof StageSemanticConfigSchema>;

/** LLM provider configuration (overrides env-var defaults when present). */
export const LlmProviderConfigSchema = z.object({
  endpoint: z.string().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().int().min(50).max(4096).default(512),
  timeoutMs: z.number().int().min(1000).max(60000).default(15000),
});
export type LlmProviderConfig = z.infer<typeof LlmProviderConfigSchema>;

/** Per-stage overrides map. */
const StagesConfigSchema = z
  .object({
    extract: StageSemanticConfigSchema.default({}),
    classify: StageSemanticConfigSchema.default({}),
    entityUpdate: StageSemanticConfigSchema.default({}),
    graphLink: StageSemanticConfigSchema.default({}),
    layerPromote: StageSemanticConfigSchema.default({}),
  })
  .default({});

/** Full agent settings document stored in MongoDB. */
export const AgentSettingsSchema = z.object({
  agentId: z.string().min(1),
  semanticLevel: SemanticLevelSchema.default("off"),
  stages: StagesConfigSchema,
  llmProvider: LlmProviderConfigSchema.default({}),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type AgentSettings = z.infer<typeof AgentSettingsSchema>;

/** Input schema for upsert (agentId comes from URL param). */
export const AgentSettingsInputSchema = AgentSettingsSchema.omit({
  agentId: true,
  createdAt: true,
  updatedAt: true,
}).partial();
export type AgentSettingsInput = z.infer<typeof AgentSettingsInputSchema>;

/**
 * Resolved settings for a single stage — computed at pipeline start.
 */
export interface ResolvedStageConfig {
  useLlm: boolean;
}

/**
 * Fully resolved pipeline settings — merged from agent + global + env defaults.
 * This is what stages read at runtime.
 */
export interface ResolvedPipelineSettings {
  stages: Record<EnhanceableStage, ResolvedStageConfig>;
  llmProvider: {
    endpoint: string;
    model: string;
    apiKey?: string;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
}

/** Global settings use this sentinel agentId. */
export const GLOBAL_SETTINGS_ID = "_global";

/** Default LLM endpoint (Ollama local). */
export const DEFAULT_LLM_ENDPOINT = "http://localhost:11434/api/generate";
/** Default LLM model. */
export const DEFAULT_LLM_MODEL = "llama3.2:3b";
