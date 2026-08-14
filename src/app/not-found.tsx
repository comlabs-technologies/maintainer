export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-[480px] flex-col justify-center px-6">
      <p className="text-[14px] font-medium">◇ Maintainer</p>
      <h1 className="mt-6 text-[26px] font-medium tracking-[-0.03em]">
        Page not found
      </h1>
      <p className="mt-2 text-[14px] text-secondary">
        The repository or migration you requested is unavailable.
      </p>
    </main>
  );
}
