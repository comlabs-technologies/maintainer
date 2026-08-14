import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { ensureCatalogSeeded } from "../src/db/seed";
import { getDb } from "../src/db/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await client.end();
  await ensureCatalogSeeded(getDb());
  console.log("Database migrated and catalog seeded");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
