"use client";

import { authClient } from "@/lib/auth-client";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <ForgotPasswordForm client={authClient} redirectTo="/reset-password" />
        </div>
      </div>
    </div>
  );
}
