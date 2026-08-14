import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth/access";
import { listSelectableRepositories } from "@/server/services/github";
import { RepositoryPicker } from "@/components/repositories/repository-picker";

export default async function SelectRepositoriesPage() {
  const userId = await requireUserId();
  const { installation, repos } = await listSelectableRepositories(userId);
  if (!installation) redirect("/app/connect");

  return (
    <div>
      <Link href="/app/repositories" className="text-[13px] text-secondary">
        ← Repositories
      </Link>
      <h1 className="mt-6 text-[26px] font-medium tracking-[-0.03em]">
        Select repositories
      </h1>
      <p className="mt-2 text-[14px] text-secondary">
        Choose which repositories Maintainer can monitor.
      </p>
      {installation.isFixture ? (
        <p className="mt-3 text-[13px] text-muted">
          Showing the development fixture repository. This is not GitHub production data.
        </p>
      ) : null}
      <div className="mt-8">
        <RepositoryPicker installationId={installation.id} repos={repos} />
      </div>
    </div>
  );
}
