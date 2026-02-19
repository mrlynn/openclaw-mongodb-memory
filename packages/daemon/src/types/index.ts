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
  ttl?: number; // seconds
}

export interface RememberRequest {
  agentId: string;
  projectId?: string;
  text: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  ttl?: number; // seconds
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
  createdAt: Date;
}

export interface MemoryStats {
  totalMemories: number;
  agentCount: number;
  storageSize: number;
  averageEmbeddingDim: number;
}
