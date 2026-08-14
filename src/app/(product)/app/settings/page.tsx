import { requireUserId, getSignedInUser } from "@/lib/auth/access";
import { getInstallationForUser } from "@/server/services/github";
import { getDb } from "@/db/client";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DisconnectGithub, PreferenceToggles } from "@/components/settings/forms";
import { githubAppInstallUrl } from "@/lib/github/app";
import { isGithubAppConfigured } from "@/lib/env";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const user = await getSignedInUser();
  const installation = await getInstallationForUser(userId);
  const db = getDb();
  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.clerkUserId, userId))
    .limit(1);

  return (
    <div className="max-w-[720px]">
      <h1 className="text-[26px] font-medium tracking-[-0.03em]">Settings</h1>

      <section className="mt-10">
        <h2 className="text-[15px] font-medium tracking-[-0.01em]">Account</h2>
        <p className="mt-2 text-[14px] text-secondary">
          Signed in as {user.name}
          {user.email ? ` · ${user.email}` : ""}. Profile, email and sessions are managed by Clerk via the account menu.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-[15px] font-medium tracking-[-0.01em]">GitHub</h2>
        <dl className="mt-4 space-y-3 text-[14px]">
          <div className="flex items-center justify-between border-b border-border py-3">
            <dt className="text-secondary">Connected GitHub account</dt>
            <dd>{installation?.accountLogin ?? "Not connected"}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-border py-3">
            <dt className="text-secondary">GitHub App installation</dt>
            <dd>
              {installation
                ? installation.isFixture
                  ? "Development fixture"
                  : installation.installationId
                : "Not installed"}
            </dd>
          </div>
          <div className="flex items-center justify-between py-3">
            <dt className="text-secondary">Repository access</dt>
            <dd>
              {isGithubAppConfigured() ? (
                <a href={githubAppInstallUrl()} className="text-link">
                  Manage on GitHub
                </a>
              ) : (
                "Configure the GitHub App to manage access"
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="text-[15px] font-medium tracking-[-0.01em]">
          Migration preferences
        </h2>
        <div className="mt-4">
          <PreferenceToggles
            runTypecheck={prefs?.runTypecheck ?? true}
            runTests={prefs?.runTests ?? true}
            runBuild={prefs?.runBuild ?? true}
            runLint={prefs?.runLint ?? true}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-[15px] font-medium tracking-[-0.01em]">Danger zone</h2>
        <p className="mt-2 text-[14px] text-secondary">
          Disconnecting GitHub stops repository access. Existing scan history remains.
        </p>
        <div className="mt-4">
          <DisconnectGithub />
        </div>
      </section>
    </div>
  );
}
