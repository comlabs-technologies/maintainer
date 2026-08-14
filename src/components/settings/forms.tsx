"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { disconnectGithubAction, updatePreferencesAction } from "@/server/actions";

export function PreferenceToggles({
  runTypecheck,
  runTests,
  runBuild,
  runLint,
}: {
  runTypecheck: boolean;
  runTests: boolean;
  runBuild: boolean;
  runLint: boolean;
}) {
  const [state, setState] = useState({
    runTypecheck,
    runTests,
    runBuild,
    runLint,
  });
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof typeof state) {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    startTransition(async () => {
      await updatePreferencesAction(next);
    });
  }

  const rows = [
    ["runTypecheck", "Run typecheck"],
    ["runTests", "Run tests"],
    ["runBuild", "Run build"],
    ["runLint", "Run lint"],
  ] as const;

  return (
    <div className="divide-y divide-border rounded-[10px] border border-border">
      {rows.map(([key, label]) => (
        <label
          key={key}
          className="flex h-14 items-center justify-between px-4 text-[14px]"
        >
          <span>{label}</span>
          <input
            type="checkbox"
            checked={state[key]}
            disabled={pending}
            onChange={() => toggle(key)}
          />
        </label>
      ))}
    </div>
  );
}

export function DisconnectGithub() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await disconnectGithubAction();
        });
      }}
    >
      {pending ? "Disconnecting…" : "Disconnect GitHub"}
    </Button>
  );
}
