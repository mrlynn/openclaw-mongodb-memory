"use client";

export async function fetchHealth(baseUrl: string) {
  const response = await fetch(`${baseUrl}/health`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  return response.json();
}

export async function fetchStatus(baseUrl: string) {
  const response = await fetch(`${baseUrl}/status`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Status failed: ${response.status}`);
  return response.json();
}

export async function rememberMemory(
  baseUrl: string,
  agentId: string,
  text: string,
  options?: {
    tags?: string[];
    metadata?: Record<string, unknown>;
    ttl?: number;
  },
) {
  const response = await fetch(`${baseUrl}/remember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId,
      text,
      tags: options?.tags || [],
      metadata: options?.metadata || {},
      ttl: options?.ttl,
    }),
  });
  if (!response.ok) throw new Error(`Remember failed: ${response.status}`);
  return response.json();
}

export async function recallMemory(
  baseUrl: string,
  agentId: string,
  query: string,
  options?: { limit?: number; tags?: string[] },
) {
  const params = new URLSearchParams({
    agentId,
    query,
    limit: String(options?.limit || 10),
  });
  if (options?.tags?.length) {
    params.set("tags", options.tags.join(","));
  }

  const response = await fetch(`${baseUrl}/recall?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Recall failed: ${response.status}`);
  const data = await response.json();
  return data.results;
}

export async function forgetMemory(baseUrl: string, id: string) {
  const response = await fetch(`${baseUrl}/forget/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`Forget failed: ${response.status}`);
  return response.json();
}

export async function exportMemories(baseUrl: string, agentId: string) {
  const params = new URLSearchParams({ agentId });
  const response = await fetch(`${baseUrl}/export?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);
  return response.json();
}

export async function purgeMemories(baseUrl: string, agentId: string, olderThan?: string) {
  const response = await fetch(`${baseUrl}/purge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, olderThan }),
  });
  if (!response.ok) throw new Error(`Purge failed: ${response.status}`);
  return response.json();
}

export async function clearMemories(baseUrl: string, agentId: string) {
  const params = new URLSearchParams({ agentId });
  const response = await fetch(`${baseUrl}/clear?${params.toString()}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`Clear failed: ${response.status}`);
  return response.json();
}

// --- Word Cloud ---

export interface WordCloudWord {
  text: string;
  count: number;
  frequency: number;
}

export interface WordCloudResponse {
  success: boolean;
  agentId: string;
  totalMemories: number;
  totalUniqueWords: number;
  words: WordCloudWord[];
}

export async function fetchWordCloud(
  baseUrl: string,
  agentId: string,
  options?: { limit?: number; minCount?: number },
): Promise<WordCloudResponse> {
  const params = new URLSearchParams({ agentId });
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.minCount) params.set("minCount", String(options.minCount));

  const response = await fetch(`${baseUrl}/wordcloud?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Word cloud failed: ${response.status}`);
  return response.json();
}

// --- Memory Map (Semantic Scatter Plot) ---

export interface MemoryMapPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  text: string;
  tags: string[];
  createdAt: string;
}

export interface MemoryMapResponse {
  success: boolean;
  agentId: string;
  count: number;
  dimensions?: number;
  varianceExplained?: [number, number, number];
  points: MemoryMapPoint[];
}

export async function fetchMemoryMap(
  baseUrl: string,
  agentId: string,
  options?: { limit?: number; dimensions?: number },
): Promise<MemoryMapResponse> {
  const params = new URLSearchParams({ agentId });
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.dimensions) params.set("dimensions", String(options.dimensions));

  const response = await fetch(`${baseUrl}/embeddings?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Memory map failed: ${response.status}`);
  return response.json();
}

// --- Memory Timeline (Activity Heatmap) ---

export interface TimelineDay {
  date: string;
  count: number;
}

export interface TimelineResponse {
  success: boolean;
  agentId: string;
  days: TimelineDay[];
  total: number;
  dateRange: { from: string; to: string };
}

export async function fetchTimeline(
  baseUrl: string,
  agentId: string,
  options?: { days?: number },
): Promise<TimelineResponse> {
  const params = new URLSearchParams({ agentId });
  if (options?.days) params.set("days", String(options.days));

  const response = await fetch(`${baseUrl}/timeline?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Timeline failed: ${response.status}`);
  return response.json();
}

// --- Memory Timeline Browser (Paginated Chronological Browse) ---

export interface MemoryTimelineItem {
  id: string;
  text: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  layer: string | null;
  memoryType: string | null;
  confidence: number | null;
}

export interface MemoriesPageResponse {
  success: boolean;
  agentId: string;
  count: number;
  hasMore: boolean;
  nextCursor: { cursor: string; cursorId: string } | null;
  memories: MemoryTimelineItem[];
}

// --- Memory Sources (Text-file vs MongoDB comparison) ---

export interface FileSourceStats {
  available: boolean;
  filePath: string | null;
  fileName: string | null;
  lastModified: string | null;
  fileSizeBytes: number | null;
  sectionCount: number;
  totalChars: number;
  tags: string[];
  sections: { title: string; charCount: number; tags: string[] }[];
}

export interface MongoSourceStats {
  available: boolean;
  totalDocuments: number;
  totalWithEmbeddings: number;
  uniqueTags: string[];
  oldestMemory: string | null;
  newestMemory: string | null;
  avgTextLength: number;
}

export interface SourceOverlap {
  fileSections: number;
  mongoDocuments: number;
  sharedCount: number;
  fileOnlyCount: number;
  mongoOnlyCount: number;
}

export interface SourcesResponse {
  success: boolean;
  agentId: string;
  file: FileSourceStats;
  mongo: MongoSourceStats;
  overlap: SourceOverlap;
}

export async function fetchSources(baseUrl: string, agentId: string): Promise<SourcesResponse> {
  const params = new URLSearchParams({ agentId });
  const response = await fetch(`${baseUrl}/sources?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Sources failed: ${response.status}`);
  return response.json();
}

// --- Memory Timeline Browser (Paginated Chronological Browse) ---

export async function fetchMemoriesPage(
  baseUrl: string,
  agentId: string,
  options?: {
    limit?: number;
    cursor?: string;
    cursorId?: string;
    sort?: "desc" | "asc";
    tags?: string[];
  },
): Promise<MemoriesPageResponse> {
  const params = new URLSearchParams({ agentId });
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.cursorId) params.set("cursorId", options.cursorId);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.tags?.length) params.set("tags", options.tags.join(","));

  const response = await fetch(`${baseUrl}/memories?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Memories fetch failed: ${response.status}`);
  return response.json();
}

// --- Agents ---

export interface AgentInfo {
  agentId: string;
  count: number;
  lastUpdated: string | null;
}

export async function fetchAgents(baseUrl: string): Promise<AgentInfo[]> {
  const response = await fetch(`${baseUrl}/agents`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Agents fetch failed: ${response.status}`);
  const data = await response.json();
  return data.agents || [];
}

// --- Backup & Restore Operations ---

export interface ExportResponse {
  success: boolean;
  agentId: string;
  count: number;
  exportedAt: string;
  memories: Array<{
    id: string;
    text: string;
    tags: string[];
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
    expiresAt: string | null;
  }>;
}

export async function exportAllMemories(
  baseUrl: string,
  agentId?: string,
): Promise<ExportResponse> {
  const params = new URLSearchParams();
  if (agentId) params.set("agentId", agentId);
  const response = await fetch(`${baseUrl}/export?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);
  return response.json();
}

export interface RestoreResponse {
  success: boolean;
  totalReceived: number;
  totalInserted: number;
  errors: Array<{ index: number; snippet: string; error: string }>;
}

// --- Usage & Cost Tracking ---

// Matches actual daemon response from GET /usage/summary
export interface UsageSummary {
  success: boolean;
  days: number;
  agentId: string;
  totalTokens: number;
  totalCostUsd: number;
  totalCalls: number;
  avgTokensPerCall: number;
  costPerMemory: number;
  totalMemories: number;
  byOperation: Record<string, { tokens: number; cost: number; calls: number }>;
  byModel: Record<string, { tokens: number; cost: number; calls: number }>;
}

// Matches actual daemon response from GET /usage/timeline
export interface UsageTimelineBucket {
  date: string;
  tokens: number;
  cost: number;
  calls: number;
}

export interface UsageTimelineResponse {
  success: boolean;
  days: number;
  granularity: string;
  buckets: UsageTimelineBucket[];
}

// Matches actual daemon response from GET /usage/by-agent
export interface UsageAgentBreakdown {
  agentId: string;
  tokens: number;
  cost: number;
  calls: number;
  memoryCount: number;
  costPerMemory: number;
  lastActivity: string;
}

export interface UsageByAgentResponse {
  success: boolean;
  days: number;
  agents: UsageAgentBreakdown[];
}

// Matches actual daemon response from GET /usage/pipeline-breakdown
export interface PipelineStageBreakdown {
  stage: string;
  tokens: number;
  cost: number;
  calls: number;
  avgTokensPerCall: number;
  percentOfTotal: number;
}

export interface PipelineBreakdownResponse {
  success: boolean;
  days: number;
  totalPipelineTokens: number;
  stages: PipelineStageBreakdown[];
}

// Matches actual daemon response from GET /usage/projections
export interface UsageProjections {
  success: boolean;
  windowDays: number;
  projectedMonthlyCostUsd: number;
  projectedMonthlyTokens: number;
  costPerMemory: number;
  costEfficiency: number;
  reflectionCostRatio: number;
  dailyAvgCostUsd: number;
  dailyAvgTokens: number;
  totalMemories: number;
  recallsInWindow: number;
}

export async function fetchUsageSummary(
  baseUrl: string,
  options?: { days?: number; agentId?: string },
): Promise<UsageSummary> {
  const params = new URLSearchParams();
  if (options?.days) params.set("days", String(options.days));
  if (options?.agentId) params.set("agentId", options.agentId);
  const response = await fetch(`${baseUrl}/usage/summary?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Usage summary failed: ${response.status}`);
  return response.json();
}

export async function fetchUsageTimeline(
  baseUrl: string,
  options?: { days?: number; granularity?: string; agentId?: string },
): Promise<UsageTimelineResponse> {
  const params = new URLSearchParams();
  if (options?.days) params.set("days", String(options.days));
  if (options?.granularity) params.set("granularity", options.granularity);
  if (options?.agentId) params.set("agentId", options.agentId);
  const response = await fetch(`${baseUrl}/usage/timeline?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Usage timeline failed: ${response.status}`);
  return response.json();
}

export async function fetchUsageByAgent(
  baseUrl: string,
  options?: { days?: number },
): Promise<UsageByAgentResponse> {
  const params = new URLSearchParams();
  if (options?.days) params.set("days", String(options.days));
  const response = await fetch(`${baseUrl}/usage/by-agent?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Usage by-agent failed: ${response.status}`);
  return response.json();
}

export async function fetchPipelineBreakdown(
  baseUrl: string,
  options?: { days?: number; agentId?: string },
): Promise<PipelineBreakdownResponse> {
  const params = new URLSearchParams();
  if (options?.days) params.set("days", String(options.days));
  if (options?.agentId) params.set("agentId", options.agentId);
  const response = await fetch(`${baseUrl}/usage/pipeline-breakdown?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Pipeline breakdown failed: ${response.status}`);
  return response.json();
}

export async function fetchUsageProjections(
  baseUrl: string,
  options?: { days?: number; agentId?: string },
): Promise<UsageProjections> {
  const params = new URLSearchParams();
  if (options?.days) params.set("days", String(options.days));
  if (options?.agentId) params.set("agentId", options.agentId);
  const response = await fetch(`${baseUrl}/usage/projections?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Usage projections failed: ${response.status}`);
  return response.json();
}

export async function restoreMemories(
  baseUrl: string,
  agentId: string,
  memories: Array<{
    text: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
    expiresAt?: string | null;
  }>,
  projectId?: string,
): Promise<RestoreResponse> {
  const response = await fetch(`${baseUrl}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, projectId, memories }),
  });
  if (!response.ok) throw new Error(`Restore failed: ${response.status}`);
  return response.json();
}
