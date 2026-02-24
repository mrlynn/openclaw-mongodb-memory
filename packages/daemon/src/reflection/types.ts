/**
 * Reflection Pipeline Types
 *
 * The reflection pipeline is a multi-stage processing system that transforms
 * raw session output into structured, layered, reliable memory.
 */

import { Memory } from "../types/index.js";
import { ResolvedPipelineSettings } from "../types/settings.js";

/**
 * Job status
 */
export type JobStatus = "pending" | "running" | "complete" | "failed";

/**
 * Reflection job document (stored in MongoDB)
 */
export interface ReflectionJob {
  _id?: string;
  agentId: string;
  sessionId?: string;
  status: JobStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  stages: StageResult[];
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result from a single stage
 */
export interface StageResult {
  stage: string;
  status: "pending" | "running" | "complete" | "skipped" | "failed";
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  itemsProcessed?: number;
  itemsCreated?: number;
  itemsUpdated?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Context passed between pipeline stages
 */
export interface PipelineContext {
  agentId: string;
  sessionId?: string;
  jobId: string;

  // Session data (if triggered by session-close)
  sessionTranscript?: string;
  sessionStartedAt?: Date;
  sessionEndedAt?: Date;

  // Accumulated data across stages
  extractedAtoms?: CandidateMemory[];
  deduplicatedAtoms?: CandidateMemory[];
  classifiedAtoms?: Memory[];

  // Resolved semantic/LLM settings for this pipeline run
  resolvedSettings?: ResolvedPipelineSettings;

  // Usage tracking (optional for backward compat)
  usageTracker?: {
    pushContext(ctx: {
      operation: string;
      agentId?: string;
      pipelineJobId?: string;
      pipelineStage?: string;
      memoryId?: string;
    }): void;
    popContext(): void;
  };

  // Metadata
  stats: {
    [key: string]: number;
  };
}

/**
 * Candidate memory (before final storage)
 */
export interface CandidateMemory {
  text: string;
  tags: string[];
  memoryType?: string;
  confidence?: number;
  sourceText?: string; // Original context where extracted
  metadata?: Record<string, unknown>;
}

/**
 * Pipeline stage interface
 */
export interface PipelineStage {
  name: string;
  execute(context: PipelineContext): Promise<PipelineContext>;
}
