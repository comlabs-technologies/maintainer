import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { upsertInstallation } from "@/server/services/github";
import { getGithubApp } from "@/lib/github/app";
import { isGithubAppConfigured } from "@/lib/env";
import { appBaseUrl } from "@/lib/env";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", appBaseUrl()));
  }
  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");
  const setupAction = url.searchParams.get("setup_action");
  if (!installationId) {
    return NextResponse.redirect(new URL("/app/connect", appBaseUrl()));
  }
  if (!isGithubAppConfigured()) {
    return NextResponse.redirect(new URL("/app/connect", appBaseUrl()));
  }
  try {
    const octokit = await getGithubApp().getInstallationOctokit(Number(installationId));
    const { data } = await octokit.rest.apps.getInstallation({
      installation_id: Number(installationId),
    });
    const account = data.account as {
      login?: string;
      type?: string;
      id?: number;
    } | null;
    await upsertInstallation({
      clerkUserId: userId,
      installationId: String(installationId),
      accountLogin: account?.login ?? "unknown",
      accountType: account?.type ?? "User",
      accountId: String(account?.id ?? installationId),
    });
  } catch {
    return NextResponse.redirect(new URL("/app/connect?error=github_installation_revoked", appBaseUrl()));
  }
  void setupAction;
  return NextResponse.redirect(new URL("/app/repositories/new", appBaseUrl()));
}
