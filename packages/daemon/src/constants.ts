/** Central constants — single source of truth */

export const DB_NAME = process.env.MEMORY_DB_NAME || "openclaw_memory";
export const COLLECTION_MEMORIES = "memories";
export const COLLECTION_SESSIONS = "sessions";
export const DEFAULT_PORT = 7654;
export const DEFAULT_MONGO_URI = "mongodb://localhost:27017";
export const DEFAULT_RECALL_LIMIT = 10;
export const MAX_RECALL_LIMIT = 100;
export const MAX_REQUEST_BODY = "50kb";
export const EMBEDDING_DIMENSIONS = 1024;
export const COLLECTION_USAGE_EVENTS = "usage_events";
export const COLLECTION_SETTINGS = "settings";
