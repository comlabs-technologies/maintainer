export function MissingConfig({
  missing,
}: {
  missing: Array<"clerk" | "database">;
}) {
  const clerk = missing.includes("clerk");
  const database = missing.includes("database");
  return (
    <main className="mx-auto flex min-h-full max-w-[520px] flex-col justify-center px-6 py-16">
      <p className="text-[14px] font-medium tracking-[-0.02em]">◇ Maintainer</p>
      <h1 className="mt-10 text-[26px] font-medium tracking-[-0.03em]">
        Environment is not ready
      </h1>
      <p className="mt-3 text-[14px] leading-6 text-secondary">
        The application deployed, but required production credentials are
        missing. Set these in the Vercel project environment, then redeploy.
      </p>
      <ul className="mt-8 space-y-4 text-[14px]">
        {clerk ? (
          <li className="rounded-[10px] border border-border px-4 py-3">
            <p className="font-medium">Clerk</p>
            <p className="mt-1 font-mono text-[13px] text-secondary">
              NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
              <br />
              CLERK_SECRET_KEY
            </p>
          </li>
        ) : null}
        {database ? (
          <li className="rounded-[10px] border border-border px-4 py-3">
            <p className="font-medium">PostgreSQL</p>
            <p className="mt-1 font-mono text-[13px] text-secondary">
              DATABASE_URL
            </p>
          </li>
        ) : null}
      </ul>
    </main>
  );
}
