"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban, CheckCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { disableUserAction, enableUserAction, deleteUserAction } from "@/actions/admin";
import type { UserAdmin } from "@/types";

interface UserActionsProps {
  user: UserAdmin;
}

export function UserActions({ user }: UserActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    setBusy(true);
    try {
      if (isDisabled) {
        await enableUserAction(user.id);
      } else {
        await disableUserAction(user.id);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteUserAction(user.id);
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  const isDisabled = user.disabled_at !== null;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="xs"
        disabled={busy}
        onClick={handleToggle}
        title={isDisabled ? "Re-enable account" : "Disable account"}
        className={isDisabled ? "text-green-700 border-green-200 hover:bg-green-50" : ""}
      >
        {busy ? (
          <Loader2 className="size-3 animate-spin" />
        ) : isDisabled ? (
          <CheckCircle className="size-3" />
        ) : (
          <Ban className="size-3" />
        )}
        {isDisabled ? "Re-enable" : "Disable"}
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              This permanently deletes <strong>{user.email}</strong> and all
              their materials, topics, and interaction history. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
