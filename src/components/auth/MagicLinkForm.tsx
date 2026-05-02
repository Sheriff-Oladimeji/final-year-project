"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Loader2 } from "lucide-react";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    const { error: err } = await authClient.signIn.magicLink({
      email: email.trim(),
      name: email.trim(),
      callbackURL: "/",
    });

    if (err) {
      setError(err.message ?? "Failed to send sign-in link.");
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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
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
          <><Loader2 className="size-4 animate-spin" /> Sending link…</>
        ) : (
          <><Mail className="size-4" /> Send sign-in link</>
        )}
      </Button>
    </form>
  );
}
