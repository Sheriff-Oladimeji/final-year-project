"use client";

import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { validateAdminEmailAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, ShieldCheck } from "lucide-react";

export function AdminMagicLinkForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);

    const { valid, error } = await validateAdminEmailAction(trimmed);
    if (!valid) {
      toast.error(error ?? "Not an admin account.");
      setLoading(false);
      return;
    }

    const { error: sendErr } = await authClient.signIn.magicLink({
      email: trimmed,
      callbackURL: "/admin/users",
    });

    if (sendErr) {
      toast.error(sendErr.message ?? "Failed to send sign-in link.");
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Mail className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Check your email</p>
        <p className="text-xs text-muted-foreground">
          A sign-in link was sent to <strong>{email}</strong>. It expires in 5 minutes.
        </p>
        <button
          className="text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => { setSent(false); setEmail(""); }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-email">Admin email address</Label>
        <Input
          id="admin-email"
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
        {loading ? (
          <><Loader2 className="size-4 animate-spin" /> Verifying…</>
        ) : (
          <><ShieldCheck className="size-4" /> Send admin sign-in link</>
        )}
      </Button>
    </form>
  );
}
