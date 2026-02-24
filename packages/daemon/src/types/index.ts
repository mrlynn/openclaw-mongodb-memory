export interface Memory {
  _id?: string;
  agentId: string;
  projectId?: string;
  text: string;
  embedding: number[];
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;

  // Phase 1: Reliability metadata
  confidence?: number;          // 0.0 – 1.0; default 0.6 on creation
  strength?: number;            // 0.0 – 1.0; decays over time
  reinforcementCount?: number;  // times recalled and acted upon
  lastReinforcedAt?: Date;

  // Phase 1: Memory classification
  layer?: MemoryLayer;          // "working" | "episodic" | "semantic" | "archival"
  memoryType?: MemoryType;      // "fact" | "preference" | "decision" | "observation" | "episode" | "opinion"
  sourceSessionId?: string;
  sourceEpisodeId?: string;     // links atom → episode

  // Phase 1: Conflict tracking
  contradictions?: Contradiction[];

  // Phase 3: Graph edges (schema reserved)
  edges?: GraphEdge[];

  // Phase 4: Cluster assignment (schema reserved)
  clusterId?: string;
  clusterLabel?: string;
}

export interface RememberRequest {
  agentId: string;
  projectId?: string;
  text: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  ttl?: number;
  
  // Phase 1: Optional explicit fields
  memoryType?: MemoryType;
  layer?: MemoryLayer;
  confidence?: number;        // Explicit override (0.0 - 1.0)
  sourceSessionId?: string;
  sourceEpisodeId?: string;
}

export interface RecallRequest {
  agentId: string;
  projectId?: string;
  query: string;
  limit?: number;
  tags?: string[];
}

export interface RecallResult {
  id: string;
  text: string;
  score: number;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// Phase 1: Foundation Types
// ============================================================================

export type MemoryLayer = "working" | "episodic" | "semantic" | "archival";

export type MemoryType = "fact" | "preference" | "decision" | "observation" | "episode" | "opinion";

export interface Contradiction {
  memoryId: string | import("mongodb").ObjectId;  // Memory ID that contradicts this one
  detectedAt: Date;
  type?: string;              // Type of contradiction (direct, temporal, etc.)
  explanation?: string;       // Human-readable explanation of the conflict
  probability?: number;       // Confidence that this is a real contradiction (0.0-1.0)
  severity?: "high" | "medium" | "low";  // Impact severity (LLM-generated)
  resolutionSuggestion?: string;         // LLM suggestion for resolution
  resolution?: ContradictionResolution;
  resolvedAt?: Date;
  resolutionNote?: string;
}

export type ContradictionResolution = 
  | "unresolved"
  | "superseded"
  | "context-dependent"
  | "temporal";

// ============================================================================
// Phase 3: Graph Types (schema reserved)
// ============================================================================

export type GraphEdgeType =
  | "PRECEDES"
  | "CAUSES"
  | "SUPPORTS"
  | "CONTRADICTS"
  | "DERIVES_FROM"
  | "SUPERSEDES"
  | "MENTIONS_ENTITY"
  | "CO_OCCURS"
  | "CONTEXT_OF";

export interface GraphEdge {
  type: GraphEdgeType;
  targetId: string;           // Memory or Entity ID
  weight: number;             // 0.0 – 1.0
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Phase 1: Episodic Memory Layer
// ============================================================================

export interface Episode {
  _id?: string;
  agentId: string;
  sessionId: string;
  startedAt: Date;
  endedAt: Date;
  title: string;              // 1-sentence summary of the session
  narrative: string;          // 3–8 sentence narrative of what happened and why
  participants: string[];     // entity slugs mentioned
  dominantTopics: string[];
  factIds: string[];          // memory atom IDs derived from this episode
  embedding: number[];        // 1024-dim embedding of narrative text
  strength: number;           // temporal decay (same as Memory)
  layer: "episodic";
}
