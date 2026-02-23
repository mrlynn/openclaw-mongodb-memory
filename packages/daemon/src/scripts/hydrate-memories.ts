#!/usr/bin/env tsx
/**
 * Memory Hydration Tool - Cross-hydrate between file-based and MongoDB
 *
 * Usage:
 *   # Import file-based → MongoDB
 *   tsx hydrate-memories.ts import ~/path/to/MEMORY.md
 *
 *   # Export MongoDB → file-based
 *   tsx hydrate-memories.ts export output.md
 *
 *   # Sync (merge both directions)
 *   tsx hydrate-memories.ts sync ~/path/to/MEMORY.md
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { existsSync } from "fs";
const rootEnvPath = __dirname + "/../../../../.env.local";
if (existsSync(rootEnvPath)) {
  config({ path: rootEnvPath });
}

import { connectDatabase, getDatabase } from "../db";
import { VoyageEmbedder } from "../embedding";
import * as fs from "fs/promises";
import * as path from "path";

interface MemoryEntry {
  text: string;
  tags: string[];
  timestamp?: string;
  source?: string;
}

const DEFAULT_AGENT_ID = process.env.AGENT_ID || "openclaw";

// Parse file-based memory format (markdown sections)
async function parseMemoryFile(filePath: string): Promise<MemoryEntry[]> {
  const content = await fs.readFile(filePath, "utf-8");
  const entries: MemoryEntry[] = [];

  // Simple parser: each section (## or ###) is a memory
  const sections = content.split(/^#{2,3}\s+/m).filter((s) => s.trim());

  for (const section of sections) {
    const lines = section.trim().split("\n");
    const title = lines[0];
    const body = lines.slice(1).join("\n").trim();

    // Extract tags from markdown (e.g., `#tag1 #tag2`)
    const tagMatches = body.match(/#[\w-]+/g) || [];
    const tags = tagMatches.map((t) => t.substring(1));

    // Extract timestamp if present (e.g., "2026-02-23 12:34 EST")
    const timestampMatch = body.match(/\b(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(\w+)\b/);
    const timestamp = timestampMatch ? timestampMatch[0] : undefined;

    entries.push({
      text: `${title}\n\n${body}`,
      tags: tags.length > 0 ? tags : ["imported"],
      timestamp,
      source: path.basename(filePath),
    });
  }

  return entries;
}

// Import: File-based → MongoDB
async function importToMongoDB(filePath: string, agentId: string): Promise<void> {
  console.log(`📥 Importing memories from ${filePath} → MongoDB (agentId: ${agentId})`);

  const entries = await parseMemoryFile(filePath);
  console.log(`   Found ${entries.length} memory sections`);

  const { db } = await connectDatabase({
    mongoUri: process.env.MONGODB_URI!,
  });

  const embedder = new VoyageEmbedder(
    process.env.VOYAGE_API_KEY || "mock",
    process.env.VOYAGE_BASE_URL,
    process.env.VOYAGE_MODEL,
  );

  const collection = db.collection("memories");
  let imported = 0;
  let skipped = 0;

  for (const entry of entries) {
    // Check if already exists (by text similarity)
    const existing = await collection.findOne({
      agentId,
      text: entry.text,
    });

    if (existing) {
      console.log(`   ⏭️  Skipped (duplicate): ${entry.text.substring(0, 60)}...`);
      skipped++;
      continue;
    }

    // Generate embedding
    const embedding = await embedder.embedOne(entry.text, "document");

    // Store in MongoDB
    await collection.insertOne({
      agentId,
      text: entry.text,
      embedding,
      tags: entry.tags,
      metadata: {
        source: entry.source,
        importedAt: new Date().toISOString(),
        originalTimestamp: entry.timestamp,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`   ✅ Imported: ${entry.text.substring(0, 60)}...`);
    imported++;
  }

  console.log(`\n✅ Import complete: ${imported} imported, ${skipped} skipped`);
}

// Export: MongoDB → File-based
async function exportFromMongoDB(outputPath: string, agentId: string): Promise<void> {
  console.log(`📤 Exporting memories from MongoDB (agentId: ${agentId}) → ${outputPath}`);

  const { db } = await connectDatabase({
    mongoUri: process.env.MONGODB_URI!,
  });

  const collection = db.collection("memories");
  const memories = await collection.find({ agentId }).sort({ createdAt: -1 }).toArray();

  console.log(`   Found ${memories.length} memories`);

  // Generate markdown
  const lines: string[] = [
    "# Exported Memories",
    "",
    `**Agent:** ${agentId}  `,
    `**Exported:** ${new Date().toISOString()}  `,
    `**Count:** ${memories.length}`,
    "",
    "---",
    "",
  ];

  for (const memory of memories) {
    const date = memory.createdAt?.toISOString().split("T")[0] || "unknown";
    const tags = memory.tags?.join(", ") || "none";

    lines.push(`## Memory (${date})`);
    lines.push("");
    lines.push(memory.text);
    lines.push("");
    lines.push(`**Tags:** ${tags}  `);
    lines.push(`**Created:** ${memory.createdAt?.toISOString() || "unknown"}  `);
    if (memory.metadata?.source) {
      lines.push(`**Source:** ${memory.metadata.source}  `);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  await fs.writeFile(outputPath, lines.join("\n"), "utf-8");
  console.log(`\n✅ Export complete: ${memories.length} memories → ${outputPath}`);
}

// Sync: Merge both directions (intelligent merge)
async function syncMemories(filePath: string, agentId: string): Promise<void> {
  console.log(`🔄 Syncing memories between ${filePath} ↔ MongoDB (agentId: ${agentId})`);

  // Step 1: Import file → MongoDB (skip duplicates)
  console.log("\n📥 Phase 1: Import file → MongoDB");
  await importToMongoDB(filePath, agentId);

  // Step 2: Export MongoDB → temp file
  const tempFile = `${filePath}.mongo-export.md`;
  console.log("\n📤 Phase 2: Export MongoDB → temp file");
  await exportFromMongoDB(tempFile, agentId);

  console.log(`\n✅ Sync complete. Review ${tempFile} and merge manually if needed.`);
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];
  const agentId = args[2] || DEFAULT_AGENT_ID;

  if (!command || !filePath) {
    console.error("Usage:");
    console.error("  tsx hydrate-memories.ts import <file> [agentId]");
    console.error("  tsx hydrate-memories.ts export <file> [agentId]");
    console.error("  tsx hydrate-memories.ts sync <file> [agentId]");
    process.exit(1);
  }

  switch (command) {
    case "import":
      await importToMongoDB(filePath, agentId);
      break;
    case "export":
      await exportFromMongoDB(filePath, agentId);
      break;
    case "sync":
      await syncMemories(filePath, agentId);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

export { parseMemoryFile, importToMongoDB, exportFromMongoDB, syncMemories };
