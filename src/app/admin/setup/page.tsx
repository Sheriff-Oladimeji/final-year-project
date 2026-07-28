export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { countAdminUsers } from "@/db/queries/admin-users";
import { AdminSetupForm } from "@/components/auth/AdminSetupForm";

// This page only ever renders once, for the very first admin account. The
// redirect here is UX — the actual enforcement is the re-check inside
// createFirstAdminAction, which runs no matter how this page is reached.
export default async function AdminSetupPage() {
  const existingCount = await countAdminUsers();
  if (existingCount > 0) redirect("/admin/login");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Set up the admin account</h1>
          <p className="text-sm text-muted-foreground">
            This page only works once. After this account is created, it can&apos;t be used again.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <AdminSetupForm />
        </div>
      </div>
    </div>
  );
}
