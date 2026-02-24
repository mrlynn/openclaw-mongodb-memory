#!/usr/bin/env tsx
/**
 * Migration 001: Foundation Schema
 * 
 * Adds Phase 1 fields to existing memory documents:
 * - confidence (default: 0.6)
 * - strength (default: 1.0)
 * - reinforcementCount (default: 0)
 * - lastReinforcedAt (default: createdAt)
 * - layer (default: "episodic")
 * - memoryType (default: "fact")
 * 
 * This migration is:
 * - Idempotent (safe to re-run)
 * - Non-destructive (only adds fields, never removes)
 * - Backward compatible (all new fields are optional)
 */

import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || "openclaw_memory";
const COLLECTION_NAME = "memories";

interface MigrationStats {
  totalDocuments: number;
  documentsUpdated: number;
  documentsSkipped: number;
  errors: number;
}

async function runMigration() {
  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI not set in environment");
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    console.log("🔌 Connecting to MongoDB...");
    await client.connect();
    console.log("✅ Connected");

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Count total documents
    const totalDocs = await collection.countDocuments();
    console.log(`📊 Total memory documents: ${totalDocs}`);

    if (totalDocs === 0) {
      console.log("✅ No documents to migrate");
      return;
    }

    const stats: MigrationStats = {
      totalDocuments: totalDocs,
      documentsUpdated: 0,
      documentsSkipped: 0,
      errors: 0,
    };

    // Find documents missing any of the new fields
    const cursor = collection.find({
      $or: [
        { confidence: { $exists: false } },
        { strength: { $exists: false } },
        { reinforcementCount: { $exists: false } },
        { lastReinforcedAt: { $exists: false } },
        { layer: { $exists: false } },
        { memoryType: { $exists: false } },
      ],
    });

    console.log("🔄 Migrating documents...");

    let batchCount = 0;
    const BATCH_SIZE = 100;

    for await (const doc of cursor) {
      try {
        const updateFields: Record<string, any> = {};

        // Add missing fields with defaults
        if (!doc.confidence) updateFields.confidence = 0.6;
        if (!doc.strength) updateFields.strength = 1.0;
        if (!doc.reinforcementCount) updateFields.reinforcementCount = 0;
        if (!doc.lastReinforcedAt) {
          updateFields.lastReinforcedAt = doc.createdAt || new Date();
        }
        if (!doc.layer) updateFields.layer = "episodic";
        if (!doc.memoryType) updateFields.memoryType = "fact";

        // Only update if there are fields to add
        if (Object.keys(updateFields).length > 0) {
          await collection.updateOne(
            { _id: doc._id },
            { $set: updateFields }
          );
          stats.documentsUpdated++;
        } else {
          stats.documentsSkipped++;
        }

        batchCount++;
        if (batchCount % BATCH_SIZE === 0) {
          console.log(`  ... processed ${batchCount} documents`);
        }
      } catch (error) {
        console.error(`❌ Error migrating document ${doc._id}:`, error);
        stats.errors++;
      }
    }

    console.log("\n✅ Migration complete!");
    console.log("📊 Statistics:");
    console.log(`  - Total documents: ${stats.totalDocuments}`);
    console.log(`  - Updated: ${stats.documentsUpdated}`);
    console.log(`  - Skipped (already migrated): ${stats.documentsSkipped}`);
    console.log(`  - Errors: ${stats.errors}`);

    // Verify migration
    console.log("\n🔍 Verifying migration...");
    const unmigrated = await collection.countDocuments({
      $or: [
        { confidence: { $exists: false } },
        { strength: { $exists: false } },
        { layer: { $exists: false } },
      ],
    });

    if (unmigrated === 0) {
      console.log("✅ All documents successfully migrated");
    } else {
      console.warn(`⚠️  ${unmigrated} documents still missing new fields`);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.close();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run migration
runMigration().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
