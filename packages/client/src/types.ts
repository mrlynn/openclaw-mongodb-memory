export interface MemoryClientConfig {
  daemonUrl: string;
  agentId: string;
  projectId?: string;
  apiKey?: string;
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
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface ExportResult {
  agentId: string;
  count: number;
  exportedAt: string;
  memories: Array<{
    id: string;
    text: string;
    tags: string[];
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date | null;
  }>;
}

export interface StatusResult {
  daemon: string;
  mongodb: string;
  voyage: string;
  uptime: number;
  memory: { heapUsed: number; heapTotal: number };
  stats: { totalMemories: number };
}
