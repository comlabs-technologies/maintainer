import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SsoCallbackPage() {
  return (
    <main className="flex min-h-full items-center justify-center">
      <AuthenticateWithRedirectCallback />
    </main>
  );
}
