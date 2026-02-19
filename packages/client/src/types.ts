export interface MemoryClientConfig {
  daemonUrl: string;
  agentId: string;
  projectId?: string;
}

export interface RememberOptions {
  tags?: string[];
  metadata?: Record<string, unknown>;
  ttl?: number; // seconds
}

export interface RecallOptions {
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
