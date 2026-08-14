"use client";

import { UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { NavLinks } from "@/components/app-shell/nav-links";

export function MobileNav({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="rounded-lg border border-border px-2 py-1 text-[13px] text-secondary"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        Menu
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-12 z-20 border-b border-border bg-white px-4 py-4 shadow-sm">
          <NavLinks />
          <div className="mt-3">
            <NavLinks settingsOnly />
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
            <UserButton />
            <span className="text-[13px] font-medium">{userName}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
