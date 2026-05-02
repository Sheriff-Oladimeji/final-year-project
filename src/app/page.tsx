export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { MagicLinkForm } from "@/components/auth/MagicLinkForm";

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    if (session.user.role === "admin") redirect("/admin/users");
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">LearnAI</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered guided learning for your course materials
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Sign in</h2>
            <p className="text-xs text-muted-foreground">
              Enter your email and we&apos;ll send you a sign-in link.
            </p>
          </div>
          <MagicLinkForm />
        </div>
      </div>
    </div>
  );
}
