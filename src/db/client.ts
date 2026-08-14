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
  const local = /localhost|127\.0\.0\.1/.test(url);
  client = postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? false : "require",
  });
  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

export type Database = ReturnType<typeof getDb>;
