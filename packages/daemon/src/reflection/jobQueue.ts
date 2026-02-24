/**
 * Reflection Job Queue
 *
 * MongoDB-backed job queue for reflection pipeline runs.
 */

import { Db, ObjectId } from "mongodb";
import { ReflectionJob, JobStatus, StageResult } from "./types.js";

const COLLECTION_JOBS = "reflection_jobs";

/**
 * Create a new reflection job
 */
export async function createJob(
  db: Db,
  agentId: string,
  sessionId?: string,
  metadata?: Record<string, unknown>,
): Promise<string> {
  const collection = db.collection<ReflectionJob>(COLLECTION_JOBS);

  const job: Omit<ReflectionJob, "_id"> = {
    agentId,
    sessionId,
    status: "pending",
    createdAt: new Date(),
    stages: [],
    metadata,
  };

  const result = await collection.insertOne(job as any);
  return result.insertedId.toString();
}

/**
 * Get a job by ID
 */
export async function getJob(db: Db, jobId: string): Promise<ReflectionJob | null> {
  const collection = db.collection<ReflectionJob>(COLLECTION_JOBS);

  try {
    return collection.findOne({ _id: new ObjectId(jobId) as any });
  } catch (error) {
    // Invalid ObjectId format
    return null;
  }
}

/**
 * Update job status
 */
export async function updateJobStatus(
  db: Db,
  jobId: string,
  status: JobStatus,
  error?: string,
): Promise<void> {
  const collection = db.collection<ReflectionJob>(COLLECTION_JOBS);

  const update: any = {
    status,
    ...(status === "running" && { startedAt: new Date() }),
    ...(status === "complete" && { completedAt: new Date() }),
    ...(status === "failed" && { completedAt: new Date(), error }),
  };

  await collection.updateOne({ _id: new ObjectId(jobId) as any }, { $set: update });
}

/**
 * Add or update a stage result.
 *
 * Uses atomic MongoDB operations to avoid read-then-write race conditions
 * (especially important with Atlas replication lag when stages complete fast).
 */
export async function updateStageResult(
  db: Db,
  jobId: string,
  stageResult: StageResult,
): Promise<void> {
  const collection = db.collection<ReflectionJob>(COLLECTION_JOBS);
  const filter = { _id: new ObjectId(jobId) as any };

  // First, try to update an existing stage entry in-place (atomic)
  const updateExisting = await collection.updateOne(
    { ...filter, "stages.stage": stageResult.stage },
    { $set: { "stages.$": stageResult } },
  );

  if (updateExisting.matchedCount === 0) {
    // Stage doesn't exist yet — push it (atomic)
    await collection.updateOne(filter, { $push: { stages: stageResult as any } });
  }
}

/**
 * List recent jobs for an agent
 */
export async function listJobs(
  db: Db,
  agentId: string,
  limit: number = 20,
): Promise<ReflectionJob[]> {
  const collection = db.collection<ReflectionJob>(COLLECTION_JOBS);

  return collection.find({ agentId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

/**
 * Get pending jobs (for worker polling)
 */
export async function getPendingJobs(db: Db, limit: number = 10): Promise<ReflectionJob[]> {
  const collection = db.collection<ReflectionJob>(COLLECTION_JOBS);

  return collection.find({ status: "pending" }).sort({ createdAt: 1 }).limit(limit).toArray();
}

/**
 * Delete old completed jobs (cleanup)
 */
export async function cleanupOldJobs(db: Db, olderThanDays: number = 30): Promise<number> {
  const collection = db.collection<ReflectionJob>(COLLECTION_JOBS);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await collection.deleteMany({
    status: { $in: ["complete", "failed"] },
    completedAt: { $lt: cutoff },
  });

  return result.deletedCount;
}
