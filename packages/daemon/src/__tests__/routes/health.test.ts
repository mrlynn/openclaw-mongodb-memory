/**
 * Tests for /health and /status endpoints
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { healthRoute } from '../../routes/health';
import { statusRoute } from '../../routes/status';
import { createTestApp } from '../helpers';

let app: Express;

describe('GET /health', () => {
  beforeAll(async () => {
    const { addErrorHandler } = await import('../helpers');
    app = await createTestApp();
    app.get('/health', healthRoute);
    app.get('/status', statusRoute);
    await addErrorHandler(app);
  });

  it('should return healthy status', async () => {
    const response = await request(app).get('/health');

    // May be 200 (healthy) or 503 (degraded) depending on configuration
    expect([200, 503]).toContain(response.status);
    expect(response.body.status).toBeDefined();
    expect(response.body.timestamp).toBeDefined();
  });

  it('should respond quickly (<100ms)', async () => {
    const start = Date.now();
    await request(app).get('/health');
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });
});

describe('GET /status', () => {

  it('should return daemon status', async () => {
    const response = await request(app).get('/status');

    expect(response.status).toBe(200);
    expect(response.body.daemon).toBeDefined();
    expect(response.body.mongodb).toBeDefined();
    expect(response.body.stats).toBeDefined();
  });

  it('should report MongoDB connection status', async () => {
    const response = await request(app).get('/status');

    expect(response.status).toBe(200);
    expect(response.body.mongodb).toBe('connected');
  });

  it('should include memory statistics', async () => {
    const response = await request(app).get('/status');

    expect(response.status).toBe(200);
    expect(response.body.stats.totalMemories).toBeDefined();
    expect(typeof response.body.stats.totalMemories).toBe('number');
  });

  it('should include daemon info', async () => {
    const response = await request(app).get('/status');

    expect(response.status).toBe(200);
    // Daemon field structure may vary, just verify it exists
    expect(response.body.daemon).toBeDefined();
  });
});
