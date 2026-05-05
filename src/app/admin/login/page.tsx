export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AdminMagicLinkForm } from "@/components/auth/AdminMagicLinkForm";

export default async function AdminLoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role === "admin") redirect("/admin/users");

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
              Only registered admin accounts can receive a link.
            </p>
          </div>
          <AdminMagicLinkForm />
        </div>
      </div>
    </div>
  );
}
