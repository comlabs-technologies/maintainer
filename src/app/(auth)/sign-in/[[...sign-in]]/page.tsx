import { SignIn } from "@clerk/nextjs";
import { ContinueWithGitHub } from "@/components/auth/continue-with-github";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ "sign-in"?: string[] }>;
}) {
  const segments = (await params)["sign-in"];
  const extraStep = Boolean(segments && segments.length > 0);

  return (
    <main className="mx-auto flex min-h-full max-w-[440px] flex-col justify-center px-6 py-16">
      <p className="text-[14px] font-medium tracking-[-0.02em]">◇ Maintainer</p>
      <h1 className="mt-10 text-[26px] font-medium tracking-[-0.03em]">
        Keep your integrations current.
      </h1>
      <p className="mt-4 text-[14px] leading-6 text-secondary">
        Maintainer detects breaking SDK changes, updates affected code, verifies
        the migration, and opens a pull request.
      </p>
      <div className="mt-8">
        {extraStep ? (
          <SignIn
            forceRedirectUrl="/app/repositories"
            signUpForceRedirectUrl="/app/repositories"
          />
        ) : (
          <ContinueWithGitHub />
        )}
      </div>
    </main>
  );
}
