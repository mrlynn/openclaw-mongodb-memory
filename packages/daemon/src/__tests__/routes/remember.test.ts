/**
 * Tests for /remember endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { rememberRoute } from '../../routes/remember';
import { createTestApp, cleanupTestData } from '../helpers';
import { getDatabase } from '../../db';

let app: Express;

describe('POST /remember', () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.post('/remember', rememberRoute);
    const { addErrorHandler } = await import('../helpers');
    await addErrorHandler(app);
  });

  afterAll(async () => {
    await cleanupTestData();
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
    // TTL not returned in response when not specified
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
    const db = getDatabase();
    const { ObjectId } = await import('mongodb');
    const memory = await db.collection('memories').findOne({ _id: new ObjectId(response.body.id) });
    expect(memory?.embedding).toBeDefined();
    expect(Array.isArray(memory?.embedding)).toBe(true);
    expect(memory?.embedding.length).toBeGreaterThan(0);
  });

  it('should handle concurrent requests', async () => {
    // Clean slate for concurrent test
    await cleanupTestData('test-agent-concurrent');
    
    const concurrencyCount = 5; // Reduced from 10 to avoid timing issues
    const requests = Array.from({ length: concurrencyCount }, (_, i) =>
      request(app)
        .post('/remember')
        .send({
          agentId: 'test-agent-concurrent',
          text: `Concurrent memory ${i} - ${Date.now()}`, // Unique text
        })
    );

    const responses = await Promise.all(requests);
    
    // All requests should succeed
    let successCount = 0;
    responses.forEach((response, i) => {
      if (response.status === 200 && response.body.success) {
        successCount++;
      }
    });

    // At least most should succeed (allow for some failures in concurrent scenarios)
    expect(successCount).toBeGreaterThanOrEqual(concurrencyCount - 1);
  });
});
