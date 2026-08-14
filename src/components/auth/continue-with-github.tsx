"use client";

import { useSignIn } from "@clerk/nextjs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export function ContinueWithGitHub() {
  const { signIn } = useSignIn();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    if (!signIn) return;
    setPending(true);
    setError(null);
    try {
      const result = await signIn.sso({
        strategy: "oauth_github",
        redirectUrl: "/app/repositories",
        redirectCallbackUrl: "/sign-in/sso-callback",
      });
      if (result.error) {
        setPending(false);
        setError(
          result.error.message ??
            "GitHub authentication failed. Confirm GitHub is enabled in Clerk.",
        );
      }
    } catch (caught) {
      setPending(false);
      setError(
        caught instanceof Error
          ? caught.message
          : "GitHub authentication failed. Confirm GitHub is enabled in Clerk.",
      );
    }
  }

  return (
    <div className="space-y-3">
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button className="w-full" onClick={onContinue} disabled={!signIn || pending}>
        {pending ? "Redirecting…" : "Continue with GitHub"}
      </Button>
    </div>
  );
}
