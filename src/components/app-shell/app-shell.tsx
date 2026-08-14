import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { NavLinks } from "@/components/app-shell/nav-links";
import { cn } from "@/lib/cn";

export function AppShell({
  children,
  userName,
  userImage,
}: {
  children: React.ReactNode;
  userName: string;
  userImage: string | null;
}) {
  return (
    <div className="flex min-h-full bg-white">
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-border bg-white md:flex">
        <div className="flex h-14 items-center px-5">
          <Link
            href="/app/repositories"
            className="text-[14px] font-medium tracking-[-0.02em] text-foreground"
          >
            ◇ Maintainer
          </Link>
        </div>
        <div className="flex flex-1 flex-col px-3 pb-4">
          <NavLinks />
          <div className="mt-auto space-y-3 px-2">
            <NavLinks settingsOnly />
            <div className="flex items-center gap-2.5 border-t border-border pt-3">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-6 w-6",
                    userButtonPopoverCard:
                      "shadow-none border border-border rounded-[10px]",
                  },
                }}
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">
                  {userName}
                </p>
              </div>
              {userImage ? null : null}
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-border px-4 md:hidden">
          <Link href="/app/repositories" className="text-[14px] font-medium">
            ◇ Maintainer
          </Link>
          <MobileNav userName={userName} />
        </header>
        <main className={cn("mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-8")}>
          {children}
        </main>
      </div>
    </div>
  );
}
