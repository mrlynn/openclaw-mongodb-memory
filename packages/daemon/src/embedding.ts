import axios, { AxiosInstance } from "axios";

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
  private model: string = "voyage-3";

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    
    // Use custom base URL (e.g., MongoDB AI endpoint) or default to Voyage API
    const url = baseUrl || "https://api.voyageai.com/v1";
    
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

  async embed(texts: string[]): Promise<number[][]> {
    try {
      console.log(`[Voyage] Embedding ${texts.length} text(s)...`);
      const response = await this.client.post<VoyageEmbedResponse>(
        "/embeddings",
        {
          input: texts,
          model: this.model,
        }
      );

      console.log(`[Voyage] Got ${response.data.data.length} embedding(s)`);

      // Sort by index to ensure correct order
      const embeddings = response.data.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      return embeddings;
    } catch (error) {
      let errorMsg = "Unknown error";
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const statusText = error.response?.statusText;
        const data = error.response?.data;
        errorMsg = `${status} ${statusText}`;
        if (typeof data === 'object' && data !== null && 'detail' in data) {
          errorMsg += ` - ${(data as any).detail}`;
        } else if (typeof data === 'string') {
          errorMsg += ` - ${data}`;
        }
      } else if (error instanceof Error) {
        errorMsg = error.message;
      }
      
      console.error(`[Voyage] Embedding failed: ${errorMsg}`);
      throw new Error(`Voyage API error: ${errorMsg}`);
    }
  }

  async embedOne(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
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
