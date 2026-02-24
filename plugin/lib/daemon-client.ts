/**
 * Shared HTTP client for the openclaw-memory daemon.
 * Used by both the main plugin (index.ts) and all hooks.
 */

// --- Types ---

export interface DaemonConfig {
  daemonUrl: string;
  agentId: string;
  apiKey?: string;
  projectId?: string;
}

export interface RecallResult {
  success: boolean;
  query: string;
  results: Array<{
    id: string;
    text: string;
    score: number;
    tags: string[];
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  count: number;
  method: string;
}

export interface RememberResult {
  success: boolean;
  id: string;
  text: string;
  tags: string[];
  ttl?: number;
}

export interface ForgetResult {
  success: boolean;
  id: string;
  message: string;
}

export interface StatusResult {
  daemon: string;
  mongodb: string;
  voyage: string;
  tier?: { label: string; description: string };
  uptime: number;
  memory: { heapUsed: number; heapTotal: number };
  stats: { totalMemories: number };
}

export interface ListMemoriesResult {
  memories: Array<{
    id: string;
    text: string;
    tags: string[];
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
  count: number;
  hasMore: boolean;
}

/** Options bag passed to most daemon-client functions. */
export interface RequestOptions {
  apiKey?: string;
  projectId?: string;
}

// --- Constants ---

const DEFAULT_TIMEOUT_MS = 10_000;
const HEALTH_TIMEOUT_MS = 2_000;
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 200;

// --- Config ---

/**
 * Resolve daemon config from environment variables.
 * Hooks use env vars set by the plugin's config bridge (see index.ts).
 */
export function getConfigFromEnv(): DaemonConfig {
  return {
    daemonUrl:
      process.env.OPENCLAW_MEMORY_DAEMON_URL || "http://localhost:7654",
    agentId: process.env.OPENCLAW_MEMORY_AGENT_ID || "openclaw",
    apiKey:
      process.env.OPENCLAW_MEMORY_API_KEY ||
      process.env.MEMORY_API_KEY ||
      undefined,
    projectId: process.env.OPENCLAW_MEMORY_PROJECT_ID || undefined,
  };
}

// --- Internal Helpers ---

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  return headers;
}

/**
 * Fetch with retry and exponential backoff.
 * Retries on 5xx and network errors. Does NOT retry 4xx (client errors).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      if (attempt === retries) return response;
    } catch (error) {
      if (attempt === retries) throw error;
    }
    await new Promise((r) =>
      setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)),
    );
  }
  throw new Error("fetchWithRetry exhausted");
}

// --- HTTP Helpers ---

/**
 * Quick health check — returns true if daemon is reachable.
 * No retry, no auth (daemon skips auth on /health).
 */
export async function checkHealth(daemonUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${daemonUrl}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Semantic search over stored memories.
 */
export async function recall(
  daemonUrl: string,
  agentId: string,
  query: string,
  limit: number = 10,
  tags?: string,
  options?: RequestOptions,
): Promise<RecallResult> {
  const url = new URL("/recall", daemonUrl);
  url.searchParams.set("agentId", agentId);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  if (tags) url.searchParams.set("tags", tags);
  if (options?.projectId) url.searchParams.set("projectId", options.projectId);

  const response = await fetchWithRetry(url.toString(), {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: buildHeaders(options?.apiKey),
  });
  if (!response.ok) {
    throw new Error(`Daemon recall failed: ${response.statusText}`);
  }
  return (await response.json()) as RecallResult;
}

/**
 * Store a new memory with optional metadata and TTL.
 */
export async function remember(
  daemonUrl: string,
  agentId: string,
  text: string,
  tags: string[] = [],
  metadata: Record<string, unknown> = {},
  ttl?: number,
  options?: RequestOptions,
): Promise<RememberResult> {
  const body: Record<string, unknown> = { agentId, text, tags, metadata };
  if (ttl !== undefined) body.ttl = ttl;
  if (options?.projectId) body.projectId = options.projectId;

  const response = await fetchWithRetry(`${daemonUrl}/remember`, {
    method: "POST",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: buildHeaders(options?.apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Daemon remember failed: ${response.statusText}`);
  }
  return (await response.json()) as RememberResult;
}

/**
 * Delete a memory by ID.
 */
export async function forget(
  daemonUrl: string,
  memoryId: string,
  options?: RequestOptions,
): Promise<ForgetResult> {
  const response = await fetchWithRetry(`${daemonUrl}/forget/${memoryId}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: buildHeaders(options?.apiKey),
  });

  if (!response.ok) {
    throw new Error(`Daemon forget failed: ${response.statusText}`);
  }
  return (await response.json()) as ForgetResult;
}

/**
 * Get daemon status including MongoDB/Voyage health and memory stats.
 */
export async function getStatus(
  daemonUrl: string,
  options?: RequestOptions,
): Promise<StatusResult> {
  const response = await fetchWithRetry(`${daemonUrl}/status`, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: buildHeaders(options?.apiKey),
  });

  if (!response.ok) {
    throw new Error(`Daemon status failed: ${response.statusText}`);
  }
  return (await response.json()) as StatusResult;
}

/**
 * List memories with optional filtering by tags and sort order.
 */
export async function listMemories(
  daemonUrl: string,
  agentId: string,
  options?: RequestOptions & {
    limit?: number;
    tags?: string;
    sort?: "desc" | "asc";
  },
): Promise<ListMemoriesResult> {
  const url = new URL("/memories", daemonUrl);
  url.searchParams.set("agentId", agentId);
  if (options?.limit) url.searchParams.set("limit", String(options.limit));
  if (options?.tags) url.searchParams.set("tags", options.tags);
  if (options?.sort) url.searchParams.set("sort", options.sort);
  if (options?.projectId) url.searchParams.set("projectId", options.projectId);

  const response = await fetchWithRetry(url.toString(), {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: buildHeaders(options?.apiKey),
  });

  if (!response.ok) {
    throw new Error(`Daemon list failed: ${response.statusText}`);
  }
  return (await response.json()) as ListMemoriesResult;
}
