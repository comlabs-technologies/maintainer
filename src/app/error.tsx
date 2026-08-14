"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-full max-w-[480px] flex-col justify-center px-6">
      <p className="text-[14px] font-medium">◇ Maintainer</p>
      <h1 className="mt-6 text-[26px] font-medium tracking-[-0.03em]">
        Something went wrong
      </h1>
      <p className="mt-2 text-[14px] text-secondary">
        {error.message || "The request could not be completed."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-9 w-fit rounded-lg border border-border px-3 text-[14px] font-medium"
      >
        Try again
      </button>
    </main>
  );
}
