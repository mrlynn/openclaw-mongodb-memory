import axios, { AxiosInstance } from "axios";
import { EventEmitter } from "events";
import type { EmbedderUsageEvent } from "./types/usage";

export interface VoyageEmbedResponse {
  object: string;
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

export class VoyageEmbedder {
  private client: AxiosInstance;
  private apiKey: string;
  private model: string;
  private useMock: boolean;

  /** EventEmitter for usage tracking — listeners get token counts after every API call */
  public readonly usageEmitter = new EventEmitter();

  // Default models by endpoint, with fallback list
  private static readonly DEFAULT_MODELS = {
    "api.voyageai.com": "voyage-4",
    "ai.mongodb.com": "voyage-4-lite",
  };

  // Fallback model list (try these in order if primary fails)
  private static readonly FALLBACK_MODELS = [
    "voyage-4",
    "voyage-4-lite",
    "voyage-4-large",
    "voyage-3",
    "voyage-3-lite",
    "voyage-code-3",
  ];

  constructor(apiKey: string, baseUrl?: string, model?: string, mock?: boolean) {
    this.apiKey = apiKey;

    // Use custom base URL (e.g., MongoDB AI endpoint) or default to Voyage API
    const url = baseUrl || "https://api.voyageai.com/v1";

    // Mock mode: prefer explicit parameter, fall back to env var
    this.useMock = mock ?? process.env.VOYAGE_MOCK === "true";

    // Pick appropriate model based on endpoint
    const hostname = url.includes("mongodb") ? "ai.mongodb.com" : "api.voyageai.com";
    this.model =
      model ||
      VoyageEmbedder.DEFAULT_MODELS[hostname as keyof typeof VoyageEmbedder.DEFAULT_MODELS] ||
      "voyage-4";

    // Both MongoDB Atlas AI (al-*) and Voyage.com public API use Bearer tokens
    this.client = axios.create({
      baseURL: url,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  }

  /** Get the model name (for cost calculation and display) */
  public getModel(): string {
    return this.model;
  }

  /** Check if running in mock mode */
  public isMockMode(): boolean {
    return this.useMock;
  }

  /**
   * Generate a mock embedding (deterministic based on text hash)
   * Useful for testing without API credentials
   */
  private mockEmbed(text: string): number[] {
    // Hash the text to get a seed
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Use seed to generate deterministic "random" embedding
    const embedding: number[] = [];
    const dim = 1024; // Voyage embedding dimension
    for (let i = 0; i < dim; i++) {
      const seed = hash + i;
      const x = Math.sin(seed) * 10000;
      const value = x - Math.floor(x); // Normalize to 0-1
      embedding.push(value * 2 - 1); // Scale to -1 to 1
    }

    // Normalize to unit vector
    let magnitude = 0;
    for (const v of embedding) {
      magnitude += v * v;
    }
    magnitude = Math.sqrt(magnitude);
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }

    return embedding;
  }

  /**
   * Embed texts with an optional input_type hint.
   * Voyage AI uses input_type to optimize embeddings:
   *   - "document": for text being stored/indexed
   *   - "query": for search queries at recall time
   * This asymmetry improves retrieval accuracy significantly.
   */
  async embed(texts: string[], inputType?: "document" | "query"): Promise<number[][]> {
    try {
      console.log(
        `[Voyage] Embedding ${texts.length} text(s)${inputType ? ` (input_type=${inputType})` : ""}...`,
      );

      // Use mock embeddings if enabled
      if (this.useMock) {
        console.log(`[Voyage] Using MOCK embeddings (VOYAGE_MOCK=true)`);
        const embeddings = texts.map((text) => this.mockEmbed(text));
        console.log(`[Voyage] Generated ${embeddings.length} mock embedding(s)`);

        // Emit mock usage event (zero tokens, but track the call)
        this.emitUsage({
          totalTokens: 0,
          model: this.model,
          inputTexts: texts.length,
          inputType,
          isMock: true,
        });

        return embeddings;
      }

      // Real Voyage API call
      console.log(`[Voyage] Using model: ${this.model}`);
      const payload: Record<string, unknown> = {
        input: texts,
        model: this.model,
      };
      if (inputType) {
        payload.input_type = inputType;
      }
      const response = await this.client.post<VoyageEmbedResponse>("/embeddings", payload);

      // Capture usage data that was previously discarded
      const usageTokens = response.data.usage?.total_tokens || 0;
      const responseModel = response.data.model || this.model;

      console.log(
        `[Voyage] Got ${response.data.data.length} embedding(s) (${usageTokens} tokens)`,
      );

      // Emit usage event for tracking
      this.emitUsage({
        totalTokens: usageTokens,
        model: responseModel,
        inputTexts: texts.length,
        inputType,
        isMock: false,
      });

      // Sort by index to ensure correct order
      const embeddings = response.data.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      return embeddings;
    } catch (error) {
      let errorMsg = "Unknown error";
      let status = 0;

      if (axios.isAxiosError(error)) {
        status = error.response?.status || 0;
        const statusText = error.response?.statusText;
        const data = error.response?.data;
        errorMsg = `${status} ${statusText}`;
        if (typeof data === "object" && data !== null && "detail" in data) {
          errorMsg += ` - ${(data as any).detail}`;
        } else if (typeof data === "string") {
          errorMsg += ` - ${data}`;
        }

        // If 403 (forbidden), suggest fallback models
        if (status === 403) {
          console.error(`[Voyage] Model "${this.model}" not available for your API key`);
          console.error(
            `[Voyage] Try one of these models: ${VoyageEmbedder.FALLBACK_MODELS.join(", ")}`,
          );
          console.error(
            `[Voyage] Set VOYAGE_MODEL env var to override (e.g., VOYAGE_MODEL=voyage-4-lite)`,
          );
        }
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }

      console.error(`[Voyage] Embedding failed: ${errorMsg}`);
      throw new Error(`Voyage API error: ${errorMsg}`);
    }
  }

  async embedOne(text: string, inputType?: "document" | "query"): Promise<number[]> {
    const [embedding] = await this.embed([text], inputType);
    return embedding;
  }

  /** Safely emit a usage event (swallows errors from listeners) */
  private emitUsage(event: EmbedderUsageEvent): void {
    try {
      this.usageEmitter.emit("usage", event);
    } catch (err) {
      console.error("[Voyage] Usage event listener error:", err);
    }
  }

  /**
   * Calculate cosine similarity between two vectors.
   * Returns a score between -1 and 1 (typically 0-1 for normalized vectors).
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
