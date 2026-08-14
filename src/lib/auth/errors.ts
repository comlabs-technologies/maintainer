export class AuthError extends Error {
  constructor(
    public code: "unauthenticated" | "forbidden" | "not_found",
    message: string,
  ) {
    super(message);
  }
}
