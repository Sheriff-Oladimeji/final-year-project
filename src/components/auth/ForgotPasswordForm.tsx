"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail } from "lucide-react";
import type { authClient } from "@/lib/auth-client";
import type { adminAuthClient } from "@/lib/admin-auth-client";

// Calls the raw `/request-password-reset` endpoint via $fetch rather than a
// named convenience method, since that name isn't stable across Better Auth
// versions — the endpoint path and body shape are what's actually documented.
export function ForgotPasswordForm({
  client,
  redirectTo,
}: {
  client: typeof authClient | typeof adminAuthClient;
  redirectTo: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await client.$fetch("/request-password-reset", {
      method: "POST",
      body: { email: email.trim(), redirectTo },
    });

    if (err) {
      setError(err.message ?? "Could not send reset link.");
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Mail className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Check your email</p>
        <p className="text-xs text-muted-foreground">
          If an account exists for <strong>{email}</strong>, a reset link is on its way.
        </p>
      </div>
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
        <Label htmlFor="forgot-email">Email address</Label>
        <Input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? <><Loader2 className="size-4 animate-spin" /> Sending…</> : "Send reset link"}
      </Button>
    </form>
  );
}
