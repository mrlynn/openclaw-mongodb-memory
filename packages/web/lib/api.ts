import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_DAEMON_URL || "http://localhost:7654";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

export const daemonApi = {
  async status() {
    const response = await client.get("/status");
    return response.data;
  },

  async remember(
    agentId: string,
    text: string,
    options?: { tags?: string[]; metadata?: Record<string, unknown>; ttl?: number }
  ) {
    const response = await client.post("/remember", {
      agentId,
      text,
      tags: options?.tags || [],
      metadata: options?.metadata || {},
      ttl: options?.ttl,
    });
    return response.data;
  },

  async recall(agentId: string, query: string, options?: { limit?: number; tags?: string[] }) {
    const response = await client.get("/recall", {
      params: {
        agentId,
        query,
        limit: options?.limit || 10,
        tags: options?.tags?.join(","),
      },
    });
    return response.data.results;
  },

  async forget(id: string) {
    const response = await client.delete(`/forget/${id}`);
    return response.data;
  },
};
