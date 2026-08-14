import { AppShell } from "@/components/app-shell/app-shell";
import { getSignedInUser } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSignedInUser();
  return (
    <AppShell userName={user.name} userImage={user.imageUrl}>
      {children}
    </AppShell>
  );
}
