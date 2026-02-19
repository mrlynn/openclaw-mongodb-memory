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

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: "https://api.voyageai.com/v1",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.client.post<VoyageEmbedResponse>(
        "/embeddings",
        {
          input: texts,
          model: this.model,
        }
      );

      // Sort by index to ensure correct order
      const embeddings = response.data.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      return embeddings;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Voyage API error: ${error.response?.status} ${error.response?.data}`
        );
      }
      throw error;
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
