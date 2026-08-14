import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { getEnv } from "@/lib/env";

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  const url = getEnv().DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  client = postgres(url, { max: 10 });
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export type Database = ReturnType<typeof getDb>;
