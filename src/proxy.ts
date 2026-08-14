import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

function clerkKeysPresent(): boolean {
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const secret = process.env.CLERK_SECRET_KEY ?? "";
  if (!publishable || !secret) return false;
  if (
    publishable.includes("replace_me") ||
    secret.includes("replace_me") ||
    secret.includes("placeholder")
  ) {
    return false;
  }
  return publishable.startsWith("pk_") && secret.startsWith("sk_");
}

const clerkProxy = clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/__clerk");

  if (!isPublic && pathname.startsWith("/app")) {
    await auth.protect();
  }

  return NextResponse.next();
});

export default clerkKeysPresent()
  ? clerkProxy
  : function proxy() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
