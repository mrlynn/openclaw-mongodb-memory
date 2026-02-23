/**
 * Tests for embedding generation (mock and real)
 */

import { describe, it, expect } from 'vitest';
import { generateEmbedding, generateMockEmbedding } from '../embedding';

describe('Mock Embeddings', () => {
  it('should generate deterministic embeddings', () => {
    const text = 'Test memory text';
    const embedding1 = generateMockEmbedding(text);
    const embedding2 = generateMockEmbedding(text);

    expect(embedding1).toEqual(embedding2);
  });

  it('should generate different embeddings for different text', () => {
    const embedding1 = generateMockEmbedding('First text');
    const embedding2 = generateMockEmbedding('Second text');

    expect(embedding1).not.toEqual(embedding2);
  });

  it('should generate embeddings of consistent length', () => {
    const embedding1 = generateMockEmbedding('Short');
    const embedding2 = generateMockEmbedding('This is a much longer piece of text for testing');

    expect(embedding1.length).toBe(embedding2.length);
    expect(embedding1.length).toBeGreaterThan(0);
  });

  it('should generate normalized vectors', () => {
    const embedding = generateMockEmbedding('Test text');
    
    // Calculate magnitude
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    // Normalized vector should have magnitude ≈ 1
    expect(magnitude).toBeCloseTo(1, 5);
  });

  it('should handle empty string', () => {
    const embedding = generateMockEmbedding('');
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
  });

  it('should handle special characters', () => {
    const embedding = generateMockEmbedding('Test with emoji 🚀 and symbols @#$%');
    
    expect(embedding).toBeDefined();
    expect(embedding.length).toBeGreaterThan(0);
  });
});

describe('Embedding Generation (via generateEmbedding)', () => {
  it('should use mock embeddings when VOYAGE_MOCK=true', async () => {
    process.env.VOYAGE_MOCK = 'true';
    
    const embedding = await generateEmbedding('Test text');
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
  });

  it('should be deterministic in mock mode', async () => {
    process.env.VOYAGE_MOCK = 'true';
    
    const embedding1 = await generateEmbedding('Same text');
    const embedding2 = await generateEmbedding('Same text');
    
    expect(embedding1).toEqual(embedding2);
  });

  // Real Voyage API tests (skip if no API key)
  it.skipIf(!process.env.VOYAGE_API_KEY)('should call real Voyage API', async () => {
    process.env.VOYAGE_MOCK = 'false';
    
    const embedding = await generateEmbedding('Test with real API');
    
    expect(embedding).toBeDefined();
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(100); // Real embeddings are larger
  });
});

describe('Cosine Similarity (indirectly tested via mock)', () => {
  it('should give high similarity for identical text', () => {
    const embedding1 = generateMockEmbedding('Identical text');
    const embedding2 = generateMockEmbedding('Identical text');

    // Calculate cosine similarity
    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
    
    expect(dotProduct).toBeCloseTo(1, 5); // Should be 1 for identical
  });

  it('should give lower similarity for different text', () => {
    const embedding1 = generateMockEmbedding('First text');
    const embedding2 = generateMockEmbedding('Completely different text');

    const dotProduct = embedding1.reduce((sum, val, i) => sum + val * embedding2[i], 0);
    
    expect(dotProduct).toBeLessThan(1);
    expect(dotProduct).toBeGreaterThan(-1);
  });
});
