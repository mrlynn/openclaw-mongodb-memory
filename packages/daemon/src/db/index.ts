import { MongoClient, Db } from "mongodb";
import { initializeSchema } from "./schema";

export interface DatabaseConfig {
  mongoUri: string;
}

let cachedDb: Db | null = null;

export async function connectDatabase(config: DatabaseConfig): Promise<Db> {
  if (cachedDb) {
    return cachedDb;
  }

  const client = new MongoClient(config.mongoUri);

  try {
    await client.connect();
    const db = client.db("openclaw_memory");

    // Initialize schema
    await initializeSchema(db);

    cachedDb = db;
    return db;
  } catch (error) {
    await client.close();
    throw error;
  }
}

export async function getDatabase(): Promise<Db> {
  if (!cachedDb) {
    throw new Error("Database not initialized. Call connectDatabase first.");
  }
  return cachedDb;
}

export async function closeDatabase(): Promise<void> {
  if (cachedDb) {
    const client = cachedDb.client;
    await client.close();
    cachedDb = null;
  }
}
