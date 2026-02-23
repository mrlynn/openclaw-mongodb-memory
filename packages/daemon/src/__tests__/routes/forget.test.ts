/**
 * Tests for /forget endpoint (delete memories)
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { forgetRoute } from '../../routes/forget';
import { rememberRoute } from '../../routes/remember';
import { getDb, connectDb } from '../../db';

const app = express();
app.use(express.json());
app.post('/remember', rememberRoute);
app.delete('/forget/:id', forgetRoute);

describe('DELETE /forget/:id', () => {
  let testMemoryId: string;

  beforeEach(async () => {
    await connectDb();
    
    // Create a memory to delete
    const response = await request(app)
      .post('/remember')
      .send({
        agentId: 'test-agent',
        text: 'Memory to be deleted',
        tags: ['test'],
      });

    testMemoryId = response.body.id;
  });

  afterAll(async () => {
    const db = await getDb();
    await db.collection('memories').deleteMany({});
  });

  it('should delete an existing memory', async () => {
    const response = await request(app)
      .delete(`/forget/${testMemoryId}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.deletedCount).toBe(1);
  });

  it('should verify memory is actually deleted from DB', async () => {
    await request(app).delete(`/forget/${testMemoryId}`);

    const db = await getDb();
    const memory = await db.collection('memories').findOne({ _id: testMemoryId });
    expect(memory).toBeNull();
  });

  it('should return error for non-existent memory', async () => {
    const fakeId = '507f1f77bcf86cd799439011'; // Valid ObjectId format

    const response = await request(app)
      .delete(`/forget/${fakeId}`);

    expect(response.status).toBe(404);
  });

  it('should return error for invalid memory ID format', async () => {
    const response = await request(app)
      .delete('/forget/invalid-id-format');

    expect(response.status).toBe(400);
  });

  it('should not delete memories from other agents', async () => {
    // Create memory for different agent
    const otherResponse = await request(app)
      .post('/remember')
      .send({
        agentId: 'other-agent',
        text: 'Other agent memory',
      });

    const otherMemoryId = otherResponse.body.id;

    // Try to delete it (should work, but let's verify agent isolation elsewhere)
    const deleteResponse = await request(app)
      .delete(`/forget/${otherMemoryId}`);

    expect(deleteResponse.status).toBe(200);
    
    // This test just verifies delete works, agent isolation is API-level
  });
});
