import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-full max-w-[640px] flex-col justify-center px-6 py-24">
      <p className="text-[14px] font-medium tracking-[-0.02em]">◇ Maintainer</p>
      <h1 className="mt-10 text-[26px] font-medium leading-8 tracking-[-0.03em]">
        APIs change.
        <br />
        Your codebase shouldn&apos;t break.
      </h1>
      <p className="mt-4 max-w-[420px] text-[14px] leading-6 text-secondary">
        Detect breaking SDK changes, migrate affected code and open verified
        pull requests before integrations fail.
      </p>
      <div className="mt-8">
        <SignedOut>
          <Link href="/sign-in" className={buttonClass("primary")}>
            Get started
          </Link>
        </SignedOut>
        <SignedIn>
          <Link href="/app/repositories" className={buttonClass("primary")}>
            Open Maintainer
          </Link>
        </SignedIn>
      </div>
      <p className="mt-16 text-[13px] text-muted">
        Works with Stripe · OpenAI · Anthropic
      </p>
    </main>
  );
}
