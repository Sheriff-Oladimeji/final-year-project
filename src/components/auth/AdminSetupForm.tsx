"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFirstAdminAction } from "@/actions/admin-setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck } from "lucide-react";

export function AdminSetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await createFirstAdminAction({ name, email, password });

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/admin/login");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-name">Name</Label>
        <Input
          id="setup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          disabled={loading}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-email">Admin email address</Label>
        <Input
          id="setup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
          disabled={loading}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="setup-password">Password</Label>
        <PasswordInput
          id="setup-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          disabled={loading}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? <><Loader2 className="size-4 animate-spin" /> Creating admin account…</> : <><ShieldCheck className="size-4" /> Create admin account</>}
      </Button>
    </form>
  );
}
