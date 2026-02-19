"use client";

const API_BASE = process.env.NEXT_PUBLIC_DAEMON_URL || "http://localhost:7654";

export async function fetchStatus() {
  const response = await fetch(`${API_BASE}/status`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Status failed: ${response.status}`);
  return response.json();
}

export async function rememberMemory(
  agentId: string,
  text: string,
  options?: { tags?: string[]; metadata?: Record<string, unknown>; ttl?: number }
) {
  const response = await fetch(`${API_BASE}/remember`, {
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

  const response = await fetch(`${API_BASE}/recall?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Recall failed: ${response.status}`);
  const data = await response.json();
  return data.results;
}

export async function forgetMemory(id: string) {
  const response = await fetch(`${API_BASE}/forget/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`Forget failed: ${response.status}`);
  return response.json();
}
