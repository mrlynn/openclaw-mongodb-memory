#!/usr/bin/env tsx
/**
 * Seed database with realistic demo data.
 *
 * Creates 50 memories across 2 agents, spread over the last 90 days,
 * with mock embeddings (no Voyage API key needed).
 *
 * Usage:
 *   pnpm --filter @openclaw-memory/daemon db:seed
 *   pnpm --filter @openclaw-memory/daemon db:seed -- --clear   # clear first
 */

import dotenv from "dotenv";
import path from "path";
import { MongoClient } from "mongodb";
import { VoyageEmbedder } from "../embedding";
import { DB_NAME, COLLECTION_MEMORIES, EMBEDDING_DIMENSIONS } from "../constants";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

// Force mock embeddings for seeding
process.env.VOYAGE_MOCK = "true";

const AGENTS = ["demo-agent", "assistant-agent"];

const MEMORIES: Array<{ text: string; tags: string[]; agent: number }> = [
  // demo-agent: developer workflow
  {
    text: "User prefers TypeScript over JavaScript for all new projects",
    tags: ["preference", "language"],
    agent: 0,
  },
  {
    text: "The team uses MongoDB Atlas for production databases and local MongoDB for development",
    tags: ["infrastructure", "database"],
    agent: 0,
  },
  {
    text: "Code reviews should focus on correctness first, then performance, then style",
    tags: ["process", "code-review"],
    agent: 0,
  },
  {
    text: "Always use pnpm workspaces for monorepo dependency management",
    tags: ["tooling", "monorepo"],
    agent: 0,
  },
  {
    text: "The API uses Express with Zod for request validation on all endpoints",
    tags: ["architecture", "validation"],
    agent: 0,
  },
  {
    text: "Vitest is the preferred test runner with supertest for HTTP route testing",
    tags: ["testing", "tooling"],
    agent: 0,
  },
  {
    text: "Semantic search uses Voyage AI embeddings with cosine similarity scoring",
    tags: ["architecture", "search"],
    agent: 0,
  },
  {
    text: "The PCA module reduces 1024-dim embeddings to 2D for visualization",
    tags: ["feature", "visualization"],
    agent: 0,
  },
  {
    text: "Docker Compose runs the full stack: MongoDB, daemon, and web dashboard",
    tags: ["deployment", "docker"],
    agent: 0,
  },
  {
    text: "The web dashboard is built with Next.js 15 and MongoDB LeafyGreen UI components",
    tags: ["frontend", "ui"],
    agent: 0,
  },
  {
    text: "Environment variables are validated at startup using Zod schemas",
    tags: ["configuration", "validation"],
    agent: 0,
  },
  {
    text: "Mock mode allows the daemon to run without a Voyage API key for development",
    tags: ["configuration", "development"],
    agent: 0,
  },
  {
    text: "The timeline heatmap shows memory creation frequency per day over 90 days",
    tags: ["feature", "visualization"],
    agent: 0,
  },
  {
    text: "Word cloud extracts top keywords from stored memories filtering stop words",
    tags: ["feature", "analytics"],
    agent: 0,
  },
  {
    text: "The /recall endpoint supports agentId, tags, and projectId filters",
    tags: ["api", "search"],
    agent: 0,
  },
  {
    text: "TTL-based memory expiration uses MongoDB TTL indexes on the expiresAt field",
    tags: ["architecture", "database"],
    agent: 0,
  },
  {
    text: "All daemon routes use asyncHandler for consistent error propagation",
    tags: ["architecture", "error-handling"],
    agent: 0,
  },
  {
    text: "The client SDK provides a typed TypeScript interface for all daemon endpoints",
    tags: ["sdk", "typescript"],
    agent: 0,
  },
  {
    text: "Startup errors display rich boxed messages with numbered fix steps",
    tags: ["ux", "error-handling"],
    agent: 0,
  },
  {
    text: "GitHub Actions CI runs typecheck, lint, format check, build, and test on every PR",
    tags: ["ci", "quality"],
    agent: 0,
  },
  {
    text: "Pre-commit hooks run ESLint and Prettier via Husky and lint-staged",
    tags: ["quality", "tooling"],
    agent: 0,
  },
  {
    text: "The setup script validates Node 18+, pnpm 8+, and generates .env.local interactively",
    tags: ["onboarding", "tooling"],
    agent: 0,
  },
  {
    text: "Coverage thresholds are set to 70% branches and 80% lines/functions/statements",
    tags: ["testing", "quality"],
    agent: 0,
  },
  {
    text: "The export endpoint returns all memories for an agent without embedding vectors",
    tags: ["api", "export"],
    agent: 0,
  },
  {
    text: "Port-in-use detection runs before app.listen to give actionable error messages",
    tags: ["ux", "startup"],
    agent: 0,
  },

  // assistant-agent: meeting notes and decisions
  {
    text: "Sprint planning decided to prioritize the search quality improvements for Q1",
    tags: ["meeting", "planning"],
    agent: 1,
  },
  {
    text: "Architecture review approved moving from REST polling to Server-Sent Events for live updates",
    tags: ["meeting", "architecture"],
    agent: 1,
  },
  {
    text: "The team agreed to use conventional commits for consistent changelog generation",
    tags: ["decision", "process"],
    agent: 1,
  },
  {
    text: "Performance benchmarks show recall latency under 50ms for 10K memories with Atlas Vector Search",
    tags: ["benchmark", "performance"],
    agent: 1,
  },
  {
    text: "Security audit recommended adding rate limiting and API key authentication to the daemon",
    tags: ["security", "audit"],
    agent: 1,
  },
  {
    text: "Database migration plan: add projectId field to all existing memories with default null",
    tags: ["migration", "database"],
    agent: 1,
  },
  {
    text: "User research showed developers want a CLI tool for quick remember/recall from terminal",
    tags: ["research", "cli"],
    agent: 1,
  },
  {
    text: "The embedding dimension was standardized to 1024 across all Voyage models",
    tags: ["decision", "embeddings"],
    agent: 1,
  },
  {
    text: "Load testing revealed connection pooling issues at 100+ concurrent requests",
    tags: ["testing", "performance"],
    agent: 1,
  },
  {
    text: "Design review approved the glass-morphism card style for the dashboard",
    tags: ["design", "ui"],
    agent: 1,
  },
  {
    text: "Incident postmortem: memory leak in PCA calculation for agents with 50K+ memories",
    tags: ["incident", "debugging"],
    agent: 1,
  },
  {
    text: "Quarterly review set target of 95% uptime for the hosted daemon service",
    tags: ["planning", "sla"],
    agent: 1,
  },
  {
    text: "Feature request: ability to share memory collections between agents via export/import",
    tags: ["feature-request", "collaboration"],
    agent: 1,
  },
  {
    text: "Tech debt review identified 13 uses of explicit any that need proper typing",
    tags: ["tech-debt", "typescript"],
    agent: 1,
  },
  {
    text: "Onboarding feedback: new developers need better getting-started documentation",
    tags: ["feedback", "documentation"],
    agent: 1,
  },
  {
    text: "Accessibility audit found missing aria labels on dashboard interactive components",
    tags: ["accessibility", "audit"],
    agent: 1,
  },
  {
    text: "Cost analysis: Voyage API costs approximately $0.10 per 1M tokens embedded",
    tags: ["cost", "embeddings"],
    agent: 1,
  },
  {
    text: "Deployment checklist updated to include vector search index verification step",
    tags: ["deployment", "checklist"],
    agent: 1,
  },
  {
    text: "Integration testing revealed edge case with empty string recall returning all memories",
    tags: ["testing", "bug"],
    agent: 1,
  },
  {
    text: "Documentation sprint planned for next week to consolidate setup guides",
    tags: ["planning", "documentation"],
    agent: 1,
  },
  {
    text: "Monitoring dashboard now tracks embedding latency, DB query time, and memory usage",
    tags: ["monitoring", "observability"],
    agent: 1,
  },
  {
    text: "API versioning strategy decided: URL path prefix /v1/ for breaking changes",
    tags: ["decision", "api"],
    agent: 1,
  },
  {
    text: "Backup strategy: daily mongodump to S3 with 30-day retention",
    tags: ["infrastructure", "backup"],
    agent: 1,
  },
  {
    text: "Release v0.2.0 includes interactive setup, config validation, and expanded test suite",
    tags: ["release", "changelog"],
    agent: 1,
  },
  {
    text: "Roadmap for v0.3.0: real-time sync, agent collaboration, and plugin system",
    tags: ["roadmap", "planning"],
    agent: 1,
  },
];

function randomDate(daysBack: number): Date {
  const now = Date.now();
  const offset = Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(now - offset);
}

async function main() {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) {
    console.error("  MONGODB_URI not set. Run: pnpm setup");
    process.exit(1);
  }

  const clearFirst = process.argv.includes("--clear");

  console.log("\n  OpenClaw Memory — Seed Demo Data\n");
  console.log(`  Database: ${DB_NAME}`);
  console.log(`  Agents:   ${AGENTS.join(", ")}`);
  console.log(`  Memories: ${MEMORIES.length}`);
  if (clearFirst) console.log("  Mode:     clear + seed");
  console.log();

  const embedder = new VoyageEmbedder("mock-key");
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_MEMORIES);

    if (clearFirst) {
      for (const agentId of AGENTS) {
        const result = await collection.deleteMany({ agentId });
        console.log(`  Cleared ${result.deletedCount} memories for "${agentId}"`);
      }
    }

    let inserted = 0;
    for (const mem of MEMORIES) {
      const agentId = AGENTS[mem.agent];
      const createdAt = randomDate(90);
      const embedding = await embedder.embedOne(mem.text, "document");

      await collection.insertOne({
        agentId,
        text: mem.text,
        tags: mem.tags,
        embedding,
        metadata: {},
        createdAt,
        updatedAt: createdAt,
        timestamp: createdAt.getTime(),
      });
      inserted++;
      process.stdout.write(`\r  Inserting... ${inserted}/${MEMORIES.length}`);
    }

    console.log(`\n\n  Seeded ${inserted} memories across ${AGENTS.length} agents.`);

    // Print per-agent counts
    for (const agentId of AGENTS) {
      const count = await collection.countDocuments({ agentId });
      console.log(`    ${agentId}: ${count} memories`);
    }

    console.log("\n  Done.\n");
  } catch (err) {
    console.error("\n  Seed failed:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
