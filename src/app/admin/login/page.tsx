export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { adminAuth } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import { countAdminUsers } from "@/db/queries/admin-users";

export default async function AdminLoginPage() {
  const session = await adminAuth.api.getSession({ headers: await headers() });
  if (session?.user) redirect("/admin/users");

  const adminCount = await countAdminUsers();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">LearnAI Admin</h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your admin email to access the dashboard.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Admin sign in</h2>
            <p className="text-xs text-muted-foreground">
              Admin accounts are pre-created. There is no sign-up here.
            </p>
          </div>
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
