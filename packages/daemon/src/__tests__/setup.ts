/**
 * Test setup - runs before all tests
 */

import { beforeAll } from 'vitest';

beforeAll(async () => {
  // Use existing MongoDB connection (from .env.local)
  // Tests will use a test database to avoid polluting production data
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI not set. Please configure .env.local');
  }
  
  // Force mock embeddings for tests (fast, deterministic, no API costs)
  process.env.VOYAGE_MOCK = 'true';
  
  console.log('Test setup complete. Using mock embeddings and existing MongoDB connection.');
});
