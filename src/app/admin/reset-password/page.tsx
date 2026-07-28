"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { adminAuthClient } from "@/lib/admin-auth-client";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

function AdminResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return <ResetPasswordForm client={adminAuthClient} token={token} redirectAfter="/admin/login" />;
}

export default function AdminResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Choose a new admin password</h1>
        </div>
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <Suspense fallback={null}>
            <AdminResetPasswordContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
