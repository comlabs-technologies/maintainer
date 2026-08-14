"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const primary = [
  { href: "/app/repositories", label: "Repositories" },
  { href: "/app/activity", label: "Activity" },
];

const settings = [{ href: "/app/settings", label: "Settings" }];

export function NavLinks({ settingsOnly = false }: { settingsOnly?: boolean }) {
  const pathname = usePathname();
  const items = settingsOnly ? settings : primary;
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-lg px-2 py-1.5 text-[14px] tracking-[-0.01em] transition-colors duration-150",
              active
                ? "bg-surface text-foreground font-medium"
                : "text-secondary hover:text-foreground hover:bg-surface",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
