"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { connectFixtureAction } from "@/server/actions";

export function ConnectFixtureButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => startTransition(async () => { await connectFixtureAction(); })}
    >
      {pending ? "Connecting…" : "Use development fixture"}
    </Button>
  );
}
