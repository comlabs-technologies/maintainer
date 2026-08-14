import { requireUserId } from "@/lib/auth/access";
import { getInstallationForUser } from "@/server/services/github";
import { githubAppInstallUrl } from "@/lib/github/app";
import { githubConnectionState } from "@/lib/github";
import { isGithubAppConfigured } from "@/lib/env";
import { ConnectFixtureButton } from "@/components/github/connect-fixture";
import { isDevFixturesEnabled } from "@/lib/env";
import { buttonClass } from "@/components/ui/button";
import { redirect } from "next/navigation";

export default async function ConnectPage() {
  const userId = await requireUserId();
  const installation = await getInstallationForUser(userId);
  if (installation && !installation.revokedAt) {
    redirect("/app/repositories/new");
  }
  const state = githubConnectionState();

  return (
    <div className="max-w-[520px]">
      <h1 className="text-[26px] font-medium tracking-[-0.03em]">Connect GitHub</h1>
      <p className="mt-3 text-[14px] leading-6 text-secondary">
        Install the Maintainer GitHub App to grant repository access. This is
        separate from signing in.
      </p>
      {isGithubAppConfigured() ? (
        <a href={githubAppInstallUrl()} className={`${buttonClass("primary")} mt-8`}>
          Install GitHub App
        </a>
      ) : (
        <div className="mt-8 rounded-[10px] border border-border bg-surface px-4 py-3 text-[14px] text-secondary">
          GitHub App credentials are not configured. Set{" "}
          <span className="font-mono text-[13px]">GITHUB_APP_ID</span>,{" "}
          <span className="font-mono text-[13px]">GITHUB_APP_SLUG</span> and{" "}
          <span className="font-mono text-[13px]">GITHUB_APP_PRIVATE_KEY</span>.
        </div>
      )}
      {isDevFixturesEnabled() && state !== "configured" ? (
        <div className="mt-8 space-y-3">
          <p className="text-[13px] text-muted">
            Development fixtures are enabled. This uses a local sample repository
            and is never mixed into production GitHub data.
          </p>
          <ConnectFixtureButton />
        </div>
      ) : null}
    </div>
  );
}
