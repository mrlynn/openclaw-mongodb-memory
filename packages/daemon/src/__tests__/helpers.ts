/**
 * Test helpers - shared utilities for setting up test environment
 */

import express, { Express } from 'express';
import { VoyageEmbedder } from '../embedding';
import { connectDatabase, getDatabase } from '../db';

let testApp: Express | null = null;

/**
 * Create Express app with routes and locals configured for testing
 * Note: Routes must be added BEFORE calling this, as error handler goes last
 */
export async function createTestApp(): Promise<Express> {
  // Always create fresh app for each test suite
  // Ensure database connection
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not set for tests');
  }

  const { db, client } = await connectDatabase({ mongoUri: process.env.MONGODB_URI });
  
  // Use mock embeddings for tests (fast, deterministic, no API costs)
  const apiKey = process.env.VOYAGE_API_KEY || 'mock-key';
  const embedder = new VoyageEmbedder(apiKey);

  const app = express();
  app.use(express.json());

  // Set up app locals (required by routes)
  app.locals.db = db;
  app.locals.embedder = embedder;
  app.locals.mongoClient = client;
  app.locals.voyageApiKey = apiKey;
  app.locals.voyageBaseUrl = undefined;

  return app;
}

/**
 * Add error handler to app (call this AFTER adding all routes)
 */
export async function addErrorHandler(app: Express): Promise<void> {
  const { errorHandler } = await import('../middleware/errorHandler');
  app.use(errorHandler);
}

/**
 * Clean up test data from database
 */
export async function cleanupTestData(agentId?: string): Promise<void> {
  const db = getDatabase();
  const collection = db.collection('memories');
  
  if (agentId) {
    await collection.deleteMany({ agentId });
  } else {
    await collection.deleteMany({});
  }
}

/**
 * Seed test data for recall tests
 */
export async function seedTestMemories(agentId: string, memories: Array<{ text: string; tags?: string[] }>): Promise<void> {
  const app = await createTestApp();
  const { default: request } = await import('supertest');
  
  for (const memory of memories) {
    await request(app)
      .post('/remember')
      .send({
        agentId,
        text: memory.text,
        tags: memory.tags || [],
      });
  }
}
