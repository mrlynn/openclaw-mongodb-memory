/**
 * Tests for /health and /status endpoints
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { healthRoute } from '../../routes/health';
import { statusRoute } from '../../routes/status';
import { connectDb } from '../../db';

const app = express();
app.use(express.json());
app.get('/health', healthRoute);
app.get('/status', statusRoute);

describe('GET /health', () => {
  beforeAll(async () => {
    await connectDb();
  });

  it('should return healthy status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
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
  beforeAll(async () => {
    await connectDb();
  });

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
    expect(response.body.daemon.version).toBeDefined();
    expect(response.body.daemon.uptime).toBeDefined();
    expect(typeof response.body.daemon.uptime).toBe('number');
  });
});
