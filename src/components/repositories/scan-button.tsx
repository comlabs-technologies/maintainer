"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { scanRepositoryAction } from "@/server/actions";

export function ScanButton({ repositoryId }: { repositoryId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await scanRepositoryAction(repositoryId);
        });
      }}
    >
      {pending ? "Scanning…" : "Scan repository"}
    </Button>
  );
}
