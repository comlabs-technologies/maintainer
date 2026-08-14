import { runMigrationJob } from "@/server/services/migrations";

const jobId = process.argv[2];
if (!jobId) {
  console.error("Usage: tsx src/server/jobs/worker.ts <jobId>");
  process.exit(1);
}

runMigrationJob(jobId)
  .then(() => {
    console.log(JSON.stringify({ ok: true, jobId }));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
