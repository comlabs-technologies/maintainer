const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9_]{20,}/g,
  /ghs_[A-Za-z0-9_]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /sk[-_](?:live|test)[_-][A-Za-z0-9]{8,}/g,
  /sk-ant-[A-Za-z0-9_-]{8,}/g,
  /pk_(?:live|test)_[A-Za-z0-9]{8,}/g,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /x-access-token:[^@\s]+/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
];

export function sanitizeLogOutput(input: string, maxChars = 20_000): string {
  let output = input ?? "";
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, "[redacted]");
  }
  output = output.replace(
    /(api[_-]?key|secret|token|password|authorization)\s*[:=]\s*["']?[^"'\s]+/gi,
    "$1=[redacted]",
  );
  if (output.length > maxChars) {
    output = `${output.slice(0, maxChars)}\n… truncated`;
  }
  return output;
}

export function isSafeGithubName(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value);
}
