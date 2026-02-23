/**
 * Tests for /recall endpoint (semantic search)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { recallRoute } from '../../routes/recall';
import { rememberRoute } from '../../routes/remember';
import { getDb, connectDb } from '../../db';

const app = express();
app.use(express.json());
app.post('/remember', rememberRoute);
app.get('/recall', recallRoute);

describe('GET /recall', () => {
  beforeAll(async () => {
    await connectDb();
    
    // Seed test data
    const memories = [
      { text: 'I prefer dark mode for all my apps', tags: ['preference', 'ui'] },
      { text: 'Use MongoDB for all database work', tags: ['database', 'preference'] },
      { text: 'Material UI is better than Tailwind', tags: ['ui', 'framework', 'decision'] },
      { text: 'The red dog watched the sunset', tags: ['random', 'test'] },
      { text: 'Vector search is powered by embeddings', tags: ['technical', 'ai'] },
    ];

    for (const memory of memories) {
      await request(app)
        .post('/remember')
        .send({
          agentId: 'test-agent',
          ...memory,
        });
    }
  });

  afterAll(async () => {
    const db = await getDb();
    await db.collection('memories').deleteMany({});
  });

  it('should find memories semantically related to query', async () => {
    const response = await request(app)
      .get('/recall')
      .query({
        agentId: 'test-agent',
        query: 'what are my UI preferences',
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBeGreaterThan(0);
    expect(response.body.results).toBeDefined();
    expect(Array.isArray(response.body.results)).toBe(true);

    // Should find "dark mode" and "Material UI" memories
    const texts = response.body.results.map((r: any) => r.text);
    expect(texts.some((t: string) => t.includes('dark mode') || t.includes('Material UI'))).toBe(true);
  });

  it('should return relevance scores', async () => {
    const response = await request(app)
      .get('/recall')
      .query({
        agentId: 'test-agent',
        query: 'database choices',
      });

    expect(response.status).toBe(200);
    expect(response.body.results.length).toBeGreaterThan(0);

    response.body.results.forEach((result: any) => {
      expect(result.score).toBeDefined();
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  it('should respect limit parameter', async () => {
    const response = await request(app)
      .get('/recall')
      .query({
        agentId: 'test-agent',
        query: 'preferences',
        limit: 2,
      });

    expect(response.status).toBe(200);
    expect(response.body.results.length).toBeLessThanOrEqual(2);
  });

  it('should filter by agent ID', async () => {
    // Store memory for different agent
    await request(app)
      .post('/remember')
      .send({
        agentId: 'other-agent',
        text: 'This is for a different agent',
      });

    const response = await request(app)
      .get('/recall')
      .query({
        agentId: 'test-agent',
        query: 'different agent',
      });

    expect(response.status).toBe(200);
    
    // Should NOT return memories from other-agent
    response.body.results.forEach((result: any) => {
      expect(result.text).not.toContain('different agent');
    });
  });

  it('should reject query without agentId', async () => {
    const response = await request(app)
      .get('/recall')
      .query({
        query: 'test query',
      });

    expect(response.status).toBe(400);
  });

  it('should reject query without query text', async () => {
    const response = await request(app)
      .get('/recall')
      .query({
        agentId: 'test-agent',
      });

    expect(response.status).toBe(400);
  });

  it('should return empty results for agent with no memories', async () => {
    const response = await request(app)
      .get('/recall')
      .query({
        agentId: 'empty-agent',
        query: 'anything',
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.results).toEqual([]);
  });

  it('should handle minScore filter', async () => {
    const response = await request(app)
      .get('/recall')
      .query({
        agentId: 'test-agent',
        query: 'UI frameworks',
        minScore: 0.8, // High threshold
      });

    expect(response.status).toBe(200);
    
    // All results should meet minimum score
    response.body.results.forEach((result: any) => {
      expect(result.score).toBeGreaterThanOrEqual(0.8);
    });
  });

  it('should sort by relevance (descending)', async () => {
    const response = await request(app)
      .get('/recall')
      .query({
        agentId: 'test-agent',
        query: 'preferences and settings',
        limit: 5,
      });

    expect(response.status).toBe(200);
    
    // Scores should be in descending order
    const scores = response.body.results.map((r: any) => r.score);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('should include all memory fields in results', async () => {
    const response = await request(app)
      .get('/recall')
      .query({
        agentId: 'test-agent',
        query: 'dark mode',
        limit: 1,
      });

    expect(response.status).toBe(200);
    expect(response.body.results.length).toBeGreaterThan(0);

    const result = response.body.results[0];
    expect(result.id).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.tags).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(result.score).toBeDefined();
    expect(result.metadata).toBeDefined();
  });
});
