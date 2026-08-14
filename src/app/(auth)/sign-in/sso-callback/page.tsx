import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { MissingConfig } from "@/components/setup/missing-config";
import { isClerkConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function SsoCallbackPage() {
  if (!isClerkConfigured()) {
    return <MissingConfig missing={["clerk"]} />;
  }

  return (
    <main className="flex min-h-full items-center justify-center text-[14px] text-secondary">
      Completing GitHub sign-in…
      <AuthenticateWithRedirectCallback />
    </main>
  );
}
