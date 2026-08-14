const SECRET_KEYS = [
  "token",
  "accessToken",
  "installationToken",
  "authorization",
  "secret",
  "privateKey",
  "apiKey",
  "clerkSecret",
  "CLERK_SECRET_KEY",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_WEBHOOK_SECRET",
  "GITHUB_CLIENT_SECRET",
  "LLM_API_KEY",
  "DATABASE_URL",
];

function shouldRedact(key: string): boolean {
  const lower = key.toLowerCase();
  return SECRET_KEYS.some((secret) => lower.includes(secret.toLowerCase()));
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        shouldRedact(key) ? "[redacted]" : redact(nested),
      ]),
    );
  }
  return value;
}

export type LogFields = Record<string, unknown>;

function write(level: string, message: string, fields?: LogFields) {
  const entry = {
    level,
    msg: message,
    time: new Date().toISOString(),
    ...((redact(fields) as LogFields) ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
  child: (base: LogFields) => ({
    info: (message: string, fields?: LogFields) =>
      write("info", message, { ...base, ...fields }),
    warn: (message: string, fields?: LogFields) =>
      write("warn", message, { ...base, ...fields }),
    error: (message: string, fields?: LogFields) =>
      write("error", message, { ...base, ...fields }),
  }),
};
