import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { verifyGithubSignature } from "@/lib/github/webhooks";
import { revokeInstallation } from "@/server/services/github";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const secret = getEnv().GITHUB_WEBHOOK_SECRET;
  const payload = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!secret || !verifyGithubSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  const body = JSON.parse(payload) as {
    action?: string;
    installation?: {
      id: number;
      account?: { login?: string; type?: string; id?: number };
    };
    requester?: { login?: string };
  };

  logger.info("github_webhook", { event, action: body.action });

  if (event === "installation" && body.installation) {
    if (body.action === "deleted" || body.action === "suspend") {
      await revokeInstallation(String(body.installation.id));
    }
  }

  return NextResponse.json({ ok: true });
}
