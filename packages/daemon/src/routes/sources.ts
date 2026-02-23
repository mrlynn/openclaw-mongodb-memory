import { Request, Response } from "express";
import { Db } from "mongodb";
import * as fs from "fs/promises";
import * as path from "path";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";
import { DaemonConfig } from "../config";

interface FileSection {
  title: string;
  charCount: number;
  tags: string[];
}

interface FileSourceStats {
  available: boolean;
  filePath: string | null;
  fileName: string | null;
  lastModified: string | null;
  fileSizeBytes: number | null;
  sectionCount: number;
  totalChars: number;
  tags: string[];
  sections: FileSection[];
}

interface MongoSourceStats {
  available: boolean;
  totalDocuments: number;
  totalWithEmbeddings: number;
  uniqueTags: string[];
  oldestMemory: string | null;
  newestMemory: string | null;
  avgTextLength: number;
}

interface SourceOverlap {
  fileSections: number;
  mongoDocuments: number;
  /** Sections from the file that have an exact text match in MongoDB */
  sharedCount: number;
  fileOnlyCount: number;
  mongoOnlyCount: number;
}

/**
 * Parse a MEMORY.md file into sections — reuses the same logic as hydrate-memories.ts
 */
async function parseMemoryFileSections(filePath: string): Promise<FileSection[]> {
  const content = await fs.readFile(filePath, "utf-8");
  const rawSections = content.split(/^#{2,3}\s+/m).filter((s) => s.trim());

  return rawSections.map((section) => {
    const lines = section.trim().split("\n");
    const title = lines[0] || "(untitled)";
    const body = lines.slice(1).join("\n").trim();
    const tagMatches = body.match(/#[\w-]+/g) || [];
    const tags = tagMatches.map((t) => t.substring(1));
    const charCount = section.trim().length;
    return { title, charCount, tags };
  });
}

export const sourcesRoute = asyncHandler(async (req: Request, res: Response) => {
  const db: Db = req.app.locals.db;
  const config: DaemonConfig | undefined = req.app.locals.config;
  const agentId = (req.query.agentId as string) || "openclaw";
  const collection = db.collection(COLLECTION_MEMORIES);

  // --- File source stats ---
  const fileStats: FileSourceStats = {
    available: false,
    filePath: null,
    fileName: null,
    lastModified: null,
    fileSizeBytes: null,
    sectionCount: 0,
    totalChars: 0,
    tags: [],
    sections: [],
  };

  const memFilePath = config?.memoryFilePath;
  if (memFilePath) {
    try {
      const stat = await fs.stat(memFilePath);
      const sections = await parseMemoryFileSections(memFilePath);
      const allTags = new Set<string>();
      let totalChars = 0;

      for (const s of sections) {
        totalChars += s.charCount;
        for (const t of s.tags) allTags.add(t);
      }

      fileStats.available = true;
      fileStats.filePath = memFilePath;
      fileStats.fileName = path.basename(memFilePath);
      fileStats.lastModified = stat.mtime.toISOString();
      fileStats.fileSizeBytes = stat.size;
      fileStats.sectionCount = sections.length;
      fileStats.totalChars = totalChars;
      fileStats.tags = [...allTags].sort();
      fileStats.sections = sections;
    } catch {
      // File not found or unreadable — leave available: false
    }
  }

  // --- MongoDB source stats ---
  const mongoStats: MongoSourceStats = {
    available: false,
    totalDocuments: 0,
    totalWithEmbeddings: 0,
    uniqueTags: [],
    oldestMemory: null,
    newestMemory: null,
    avgTextLength: 0,
  };

  try {
    const totalDocuments = await collection.countDocuments({ agentId });
    const totalWithEmbeddings = await collection.countDocuments({
      agentId,
      embedding: { $exists: true, $ne: null },
    });

    // Unique tags via aggregation
    const tagsPipeline = [
      { $match: { agentId } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags" } },
      { $sort: { _id: 1 as const } },
    ];
    const tagsResult = await collection.aggregate(tagsPipeline).toArray();
    const uniqueTags = tagsResult.map((t) => t._id as string);

    // Oldest and newest
    const oldest = await collection.findOne({ agentId }, { sort: { createdAt: 1 } });
    const newest = await collection.findOne({ agentId }, { sort: { createdAt: -1 } });

    // Avg text length
    const avgPipeline = [
      { $match: { agentId } },
      {
        $group: {
          _id: null,
          avgLen: { $avg: { $strLenCP: "$text" } },
        },
      },
    ];
    const avgResult = await collection.aggregate(avgPipeline).toArray();
    const avgTextLength = avgResult[0]?.avgLen ? Math.round(avgResult[0].avgLen) : 0;

    mongoStats.available = true;
    mongoStats.totalDocuments = totalDocuments;
    mongoStats.totalWithEmbeddings = totalWithEmbeddings;
    mongoStats.uniqueTags = uniqueTags;
    mongoStats.oldestMemory = oldest?.createdAt?.toISOString?.() || oldest?.createdAt || null;
    mongoStats.newestMemory = newest?.createdAt?.toISOString?.() || newest?.createdAt || null;
    mongoStats.avgTextLength = avgTextLength;
  } catch {
    // MongoDB query failure — leave available: false
  }

  // --- Overlap analysis ---
  const overlap: SourceOverlap = {
    fileSections: fileStats.sectionCount,
    mongoDocuments: mongoStats.totalDocuments,
    sharedCount: 0,
    fileOnlyCount: fileStats.sectionCount,
    mongoOnlyCount: mongoStats.totalDocuments,
  };

  // If both sources are available, compute overlap via text matching
  if (fileStats.available && mongoStats.available && fileStats.sections.length > 0) {
    try {
      const memFilePath2 = config?.memoryFilePath;
      if (memFilePath2) {
        const content = await fs.readFile(memFilePath2, "utf-8");
        const rawSections = content.split(/^#{2,3}\s+/m).filter((s) => s.trim());
        let sharedCount = 0;

        for (const section of rawSections) {
          const lines = section.trim().split("\n");
          const title = lines[0] || "";
          const body = lines.slice(1).join("\n").trim();
          const fullText = `${title}\n\n${body}`;

          // Check if MongoDB has an exact match
          const match = await collection.findOne({ agentId, text: fullText });
          if (match) sharedCount++;
        }

        overlap.sharedCount = sharedCount;
        overlap.fileOnlyCount = fileStats.sectionCount - sharedCount;
        overlap.mongoOnlyCount = mongoStats.totalDocuments - sharedCount;
      }
    } catch {
      // Overlap calculation failed — leave at defaults
    }
  }

  res.json({
    success: true,
    agentId,
    file: fileStats,
    mongo: mongoStats,
    overlap,
  });
});
