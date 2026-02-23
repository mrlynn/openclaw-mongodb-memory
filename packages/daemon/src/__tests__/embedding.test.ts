/**
 * Tests for VoyageEmbedder (mock and real)
 */

import { describe, it, expect } from 'vitest';
import { VoyageEmbedder } from '../embedding';

describe('VoyageEmbedder - Mock Mode', () => {
  const embedder = new VoyageEmbedder('mock-key');

  it('should generate embeddings in mock mode', async () => {
    const embedding = await embedder.embedOne('Test text');
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
  });

  it('should generate deterministic embeddings', async () => {
    const text = 'Test memory text';
    const embedding1 = await embedder.embedOne(text);
    const embedding2 = await embedder.embedOne(text);

    expect(embedding1).toEqual(embedding2);
  });

  it('should generate different embeddings for different text', async () => {
    const embedding1 = await embedder.embedOne('First text');
    const embedding2 = await embedder.embedOne('Second text');

    expect(embedding1).not.toEqual(embedding2);
  });

  it('should generate embeddings of consistent length', async () => {
    const embedding1 = await embedder.embedOne('Short');
    const embedding2 = await embedder.embedOne('This is a much longer piece of text for testing');

    expect(embedding1.length).toBe(embedding2.length);
    expect(embedding1.length).toBeGreaterThan(0);
  });

  it('should generate normalized vectors', async () => {
    const embedding = await embedder.embedOne('Test text');
    
    // Calculate magnitude
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    // Normalized vector should have magnitude ≈ 1
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it('should handle empty string', async () => {
    const embedding = await embedder.embedOne('');
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
  });

  it('should handle special characters', async () => {
    const embedding = await embedder.embedOne('Test with emoji 🚀 and symbols @#$%');
    
    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
  });

  it('should handle batch embeddings', async () => {
    const texts = ['First text', 'Second text', 'Third text'];
    const embeddings = await embedder.embed(texts);

    expect(embeddings.length).toBe(3);
    embeddings.forEach(emb => {
      expect(Array.isArray(emb)).toBe(true);
      expect(emb.length).toBeGreaterThan(0);
    });
  });
});

describe('VoyageEmbedder - Cosine Similarity', () => {
  it('should calculate cosine similarity correctly', async () => {
    const embedder = new VoyageEmbedder('mock-key');
    
    const embedding1 = await embedder.embedOne('Identical text');
    const embedding2 = await embedder.embedOne('Identical text');

    const similarity = VoyageEmbedder.cosineSimilarity(embedding1, embedding2);
    
    expect(similarity).toBeCloseTo(1, 5); // Should be 1 for identical
  });

  it('should give lower similarity for different text', async () => {
    const embedder = new VoyageEmbedder('mock-key');
    
    const embedding1 = await embedder.embedOne('First text');
    const embedding2 = await embedder.embedOne('Completely different text');

    const similarity = VoyageEmbedder.cosineSimilarity(embedding1, embedding2);
    
    expect(similarity).toBeLessThan(1);
    expect(similarity).toBeGreaterThan(-1);
  });

  it('should throw error for vectors of different length', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2];

    expect(() => VoyageEmbedder.cosineSimilarity(vec1, vec2)).toThrow();
  });
});

describe('VoyageEmbedder - Real API (conditional)', () => {
  it.skipIf(!process.env.VOYAGE_API_KEY || process.env.VOYAGE_MOCK === 'true')(
    'should call real Voyage API', 
    async () => {
      const embedder = new VoyageEmbedder(process.env.VOYAGE_API_KEY!);
      
      const embedding = await embedder.embedOne('Test with real API');
      
      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(100); // Real embeddings are larger
    }
  );
});
