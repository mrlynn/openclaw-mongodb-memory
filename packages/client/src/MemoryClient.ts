import axios, { AxiosInstance } from "axios";
import type { MemoryClientConfig, RememberOptions, RecallOptions, RecallResult } from "./types";

export class MemoryClient {
  private client: AxiosInstance;
  private agentId: string;
  private projectId?: string;

  constructor(config: MemoryClientConfig) {
    this.client = axios.create({
      baseURL: config.daemonUrl,
      timeout: 10000,
    });
    this.agentId = config.agentId;
    this.projectId = config.projectId;
  }

  async remember(text: string, options?: RememberOptions): Promise<string> {
    const response = await this.client.post("/remember", {
      agentId: this.agentId,
      projectId: this.projectId,
      text,
      tags: options?.tags,
      metadata: options?.metadata,
      ttl: options?.ttl,
    });
    return response.data.id;
  }

  async recall(query: string, options?: RecallOptions): Promise<RecallResult[]> {
    const params = {
      agentId: this.agentId,
      projectId: this.projectId,
      query,
      limit: options?.limit ?? 10,
      tags: options?.tags?.join(","),
    };

    const response = await this.client.get("/recall", { params });
    return response.data.results;
  }

  async forget(id: string): Promise<void> {
    await this.client.delete(`/forget/${id}`);
  }

  async health(): Promise<boolean> {
    try {
      await this.client.get("/health");
      return true;
    } catch {
      return false;
    }
  }
}
