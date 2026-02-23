/**
 * Tests for /remember endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { rememberRoute } from '../../routes/remember';
import { getDb, connectDb } from '../../db';

const app = express();
app.use(express.json());
app.post('/remember', rememberRoute);

describe('POST /remember', () => {
  beforeAll(async () => {
    await connectDb();
  });

  afterAll(async () => {
    const db = await getDb();
    await db.collection('memories').deleteMany({});
  });

  it('should store a memory with all fields', async () => {
    const response = await request(app)
      .post('/remember')
      .send({
        agentId: 'test-agent',
        text: 'I prefer dark mode for all my apps',
        tags: ['preference', 'ui'],
        ttl: 86400,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.id).toBeDefined();
    expect(response.body.text).toBe('I prefer dark mode for all my apps');
    expect(response.body.tags).toEqual(['preference', 'ui']);
    expect(response.body.ttl).toBe(86400);
  });

  it('should store a memory with minimal fields (defaults)', async () => {
    const response = await request(app)
      .post('/remember')
      .send({
        agentId: 'test-agent',
        text: 'Minimal memory test',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.id).toBeDefined();
    expect(response.body.tags).toEqual([]);
    expect(response.body.ttl).toBeGreaterThan(0); // Should have default TTL
  });

  it('should reject memory without agentId', async () => {
    const response = await request(app)
      .post('/remember')
      .send({
        text: 'No agent ID provided',
      });

    expect(response.status).toBe(400);
  });

  it('should reject memory without text', async () => {
    const response = await request(app)
      .post('/remember')
      .send({
        agentId: 'test-agent',
      });

    expect(response.status).toBe(400);
  });

  it('should reject memory with invalid TTL (negative)', async () => {
    const response = await request(app)
      .post('/remember')
      .send({
        agentId: 'test-agent',
        text: 'Invalid TTL test',
        ttl: -1000,
      });

    expect(response.status).toBe(400);
  });

  it('should handle empty tags array', async () => {
    const response = await request(app)
      .post('/remember')
      .send({
        agentId: 'test-agent',
        text: 'Empty tags test',
        tags: [],
      });

    expect(response.status).toBe(200);
    expect(response.body.tags).toEqual([]);
  });

  it('should generate embedding (mock mode)', async () => {
    const response = await request(app)
      .post('/remember')
      .send({
        agentId: 'test-agent',
        text: 'Test embedding generation',
      });

    expect(response.status).toBe(200);
    
    // Verify memory was stored with embedding in DB
    const db = await getDb();
    const memory = await db.collection('memories').findOne({ _id: response.body.id });
    expect(memory?.embedding).toBeDefined();
    expect(Array.isArray(memory?.embedding)).toBe(true);
    expect(memory?.embedding.length).toBeGreaterThan(0);
  });

  it('should handle concurrent requests', async () => {
    const requests = Array.from({ length: 10 }, (_, i) =>
      request(app)
        .post('/remember')
        .send({
          agentId: 'test-agent',
          text: `Concurrent memory ${i}`,
        })
    );

    const responses = await Promise.all(requests);
    
    responses.forEach((response) => {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    // Verify all 10 memories were stored
    const db = await getDb();
    const count = await db.collection('memories').countDocuments({ agentId: 'test-agent' });
    expect(count).toBeGreaterThanOrEqual(10);
  });
});
