"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createNotebookAction } from "@/actions/notebooks";

export function NewNotebookDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("title", title.trim());
    // createNotebookAction redirects on success, so this won't return on success.
    const result = await createNotebookAction(fd);
    if (result && "error" in result) {
      setError(result.error ?? "Could not create notebook.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          New notebook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create notebook</DialogTitle>
            <DialogDescription>
              Give your notebook a name. You&apos;ll add up to 10 sources next.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Operating Systems CSC 401"
            autoFocus
            maxLength={255}
            className="my-4"
            disabled={busy}
          />
          {error && <p className="text-xs text-destructive mb-3">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
