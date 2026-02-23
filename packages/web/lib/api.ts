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
  }
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
  options?: { limit?: number; tags?: string[] }
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

export async function purgeMemories(
  baseUrl: string,
  agentId: string,
  olderThan?: string
) {
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
  options?: { limit?: number; minCount?: number }
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
