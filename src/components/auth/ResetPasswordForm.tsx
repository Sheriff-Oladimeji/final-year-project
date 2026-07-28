"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import type { authClient } from "@/lib/auth-client";
import type { adminAuthClient } from "@/lib/admin-auth-client";

export function ResetPasswordForm({
  client,
  token,
  redirectAfter,
}: {
  client: typeof authClient | typeof adminAuthClient;
  token: string | null;
  redirectAfter: string;
}) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("This reset link is invalid or has expired. Request a new one.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error: err } = await client.$fetch("/reset-password", {
      method: "POST",
      body: { newPassword, token },
    });

    if (err) {
      setError(err.message ?? "Could not reset your password.");
      setLoading(false);
    } else {
      router.push(redirectAfter);
    }
  }

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertDescription>This reset link is invalid or has expired. Request a new one.</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? <><Loader2 className="size-4 animate-spin" /> Resetting…</> : "Reset password"}
      </Button>
    </form>
  );
}
