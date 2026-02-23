/**
 * Tests for /status endpoint
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { Express } from "express";
import { statusRoute } from "../../routes/status";
import { createTestApp, addErrorHandler } from "../helpers";

let app: Express;

describe("GET /status", () => {
  beforeAll(async () => {
    app = await createTestApp();
    app.get("/status", statusRoute);
    await addErrorHandler(app);
  });

  it("should return daemon status with all fields", async () => {
    const res = await request(app).get("/status");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty("daemon");
    expect(res.body).toHaveProperty("mongodb");
    expect(res.body).toHaveProperty("voyage");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("memory");
    expect(res.body).toHaveProperty("stats");
  });

  it("should report MongoDB as connected", async () => {
    const res = await request(app).get("/status");

    expect(res.status).toBe(200);
    expect(res.body.mongodb).toBe("connected");
  });

  it("should include memory usage in MB", async () => {
    const res = await request(app).get("/status");

    expect(res.status).toBe(200);
    expect(res.body.memory).toHaveProperty("heapUsed");
    expect(res.body.memory).toHaveProperty("heapTotal");
    expect(typeof res.body.memory.heapUsed).toBe("number");
    expect(typeof res.body.memory.heapTotal).toBe("number");
  });

  it("should include total memory count in stats", async () => {
    const res = await request(app).get("/status");

    expect(res.status).toBe(200);
    expect(res.body.stats).toHaveProperty("totalMemories");
    expect(typeof res.body.stats.totalMemories).toBe("number");
  });
});
