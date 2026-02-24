/**
 * Re-embed all stored memories using the current Voyage model.
 *
 * This script is needed when:
 *   - Memories were stored with mock embeddings (VOYAGE_MOCK=true)
 *   - The Voyage model was changed (e.g., voyage-3 -> voyage-4)
 *   - input_type support was added and existing embeddings need refresh
 *
 * Usage:
 *   npx tsx src/scripts/reembed.ts                    # re-embed everything
 *   npx tsx src/scripts/reembed.ts --agent openclaw   # re-embed one agent
 *   npx tsx src/scripts/reembed.ts --dry-run          # preview without writing
 *
 * Reads MONGODB_URI, VOYAGE_API_KEY, VOYAGE_BASE_URL, VOYAGE_MODEL from
 * .env.local at the monorepo root (same config as the daemon).
 */

import dotenv from "dotenv";
import path from "path";
import { MongoClient } from "mongodb";
import { VoyageEmbedder } from "../embedding";
import { DB_NAME, COLLECTION_MEMORIES } from "../constants";

// Load env from monorepo root (same as server.ts)
dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

// ---- Config ----
const BATCH_SIZE = 20; // texts per Voyage API call (stay under rate limits)
const DELAY_MS = 200; // pause between batches to avoid 429s

// ---- CLI args ----
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const agentIdx = args.indexOf("--agent");
const agentFilter = agentIdx !== -1 ? args[agentIdx + 1] : undefined;

async function main() {
  const MONGO_URI = process.env.MONGODB_URI;
  const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
  const VOYAGE_BASE_URL = process.env.VOYAGE_BASE_URL;
  const VOYAGE_MODEL = process.env.VOYAGE_MODEL;

  if (!MONGO_URI) {
    console.error("MONGODB_URI not set");
    process.exit(1);
  }
  if (!VOYAGE_API_KEY) {
    console.error("VOYAGE_API_KEY not set");
    process.exit(1);
  }

  // Force real embeddings regardless of VOYAGE_MOCK setting
  const origMock = process.env.VOYAGE_MOCK;
  process.env.VOYAGE_MOCK = "false";

  const embedder = new VoyageEmbedder(VOYAGE_API_KEY, VOYAGE_BASE_URL, VOYAGE_MODEL);

  // Restore (doesn't matter, but be clean)
  if (origMock !== undefined) process.env.VOYAGE_MOCK = origMock;

  console.log("=== OpenClaw Memory Re-Embedding ===");
  console.log(`  Database:   ${DB_NAME}`);
  console.log(`  Mongo URI:  ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")}`);
  console.log(`  Model:      ${VOYAGE_MODEL || "(default)"}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Agent:      ${agentFilter || "(all)"}`);
  console.log(`  Dry run:    ${dryRun}`);
  console.log();

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_MEMORIES);

  // Build filter
  const filter: Record<string, unknown> = {};
  if (agentFilter) filter.agentId = agentFilter;

  const totalCount = await collection.countDocuments(filter);
  console.log(`Found ${totalCount} memories to re-embed.\n`);

  if (totalCount === 0) {
    console.log("Nothing to do.");
    await client.close();
    return;
  }

  // Stream all memories (only need _id and text)
  const cursor = collection.find(filter, {
    projection: { _id: 1, text: 1 },
    sort: { createdAt: 1 },
  });

  // Collect into batches
  let batch: Array<{ _id: any; text: string }> = [];
  let processed = 0;
  let updated = 0;
  let errors = 0;

  const processBatch = async (items: Array<{ _id: any; text: string }>) => {
    const texts = items.map((d) => d.text);

    try {
      const embeddings = await embedder.embed(texts, "document");

      if (!dryRun) {
        // Bulk-write all updates
        const bulkOps = items.map((item, i) => ({
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: {
                embedding: embeddings[i],
                updatedAt: new Date(),
              },
            },
          },
        }));
        const result = await collection.bulkWrite(bulkOps);
        updated += result.modifiedCount;
      } else {
        updated += items.length;
      }
    } catch (err) {
      console.error(`  ERROR embedding batch: ${err}`);
      errors += items.length;
    }

    processed += items.length;
    const pct = ((processed / totalCount) * 100).toFixed(1);
    process.stdout.write(
      `\r  Progress: ${processed}/${totalCount} (${pct}%) | Updated: ${updated} | Errors: ${errors}`
    );
  };

  for await (const doc of cursor) {
    batch.push({ _id: doc._id, text: doc.text as string });

    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch);
      batch = [];
      // Small delay between batches to respect rate limits
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  // Process remaining
  if (batch.length > 0) {
    await processBatch(batch);
  }

  console.log("\n");
  console.log("=== Done ===");
  console.log(`  Total processed: ${processed}`);
  console.log(`  Updated:         ${updated}`);
  console.log(`  Errors:          ${errors}`);
  if (dryRun) {
    console.log("  (Dry run — no changes written to database)");
  }

  await client.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
