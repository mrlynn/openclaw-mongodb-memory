import { MongoClient, Db } from "mongodb";
import { initializeSchema } from "./schema";
import { DB_NAME } from "../constants";

export interface DatabaseConfig {
  mongoUri: string;
}

export interface DatabaseConnection {
  client: MongoClient;
  db: Db;
}

let cached: DatabaseConnection | null = null;

export async function connectDatabase(config: DatabaseConfig): Promise<DatabaseConnection> {
  if (cached) {
    return cached;
  }

  const client = new MongoClient(config.mongoUri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    await initializeSchema(db);

    cached = { client, db };
    return cached;
  } catch (error) {
    await client.close();
    throw error;
  }
}

export function getDatabase(): Db {
  if (!cached) {
    throw new Error("Database not initialized. Call connectDatabase first.");
  }
  return cached.db;
}

export async function closeDatabase(): Promise<void> {
  if (cached) {
    await cached.client.close();
    cached = null;
  }
}
