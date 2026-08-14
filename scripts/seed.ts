import { getDb } from "@/db/client";
import { ensureCatalogSeeded } from "@/db/seed";

async function main() {
  const db = getDb();
  await ensureCatalogSeeded(db);
  console.log("Catalog seeded");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
