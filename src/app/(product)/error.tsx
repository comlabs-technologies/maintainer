"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[480px] py-16">
      <h1 className="text-[26px] font-medium tracking-[-0.03em]">
        Something went wrong
      </h1>
      <p className="mt-2 text-[14px] text-secondary">
        {error.message || "The request could not be completed."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-9 rounded-lg border border-border px-3 text-[14px] font-medium"
      >
        Try again
      </button>
    </div>
  );
}
