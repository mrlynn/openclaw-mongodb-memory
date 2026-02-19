import axios, { AxiosInstance } from "axios";
import type {
  MemoryClientConfig,
  RememberOptions,
  RecallOptions,
  RecallResult,
  ExportResult,
  StatusResult,
} from "./types";

export class MemoryClient {
  private client: AxiosInstance;
  private agentId: string;
  private projectId?: string;

  constructor(config: MemoryClientConfig) {
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers["X-API-Key"] = config.apiKey;
    }

    this.client = axios.create({
      baseURL: config.daemonUrl,
      timeout: 10000,
      headers,
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

  async status(): Promise<StatusResult> {
    const response = await this.client.get("/status");
    return response.data;
  }

  async export(): Promise<ExportResult> {
    const params = {
      agentId: this.agentId,
      projectId: this.projectId,
    };
    const response = await this.client.get("/export", { params });
    return response.data;
  }

  async purge(olderThan: Date): Promise<number> {
    const response = await this.client.post("/purge", {
      agentId: this.agentId,
      olderThan: olderThan.toISOString(),
    });
    return response.data.deleted;
  }

  async clear(): Promise<number> {
    const response = await this.client.delete("/clear", {
      params: { agentId: this.agentId },
    });
    return response.data.deleted;
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
