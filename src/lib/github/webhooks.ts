import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyGithubSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
