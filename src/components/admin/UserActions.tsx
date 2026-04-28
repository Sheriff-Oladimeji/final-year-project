"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Ban, Trash2 } from "lucide-react";
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
import { disableUser, deleteUser } from "@/lib/api/admin";
import type { UserAdmin } from "@/types";

interface UserActionsProps {
  user: UserAdmin;
}

export function UserActions({ user }: UserActionsProps) {
  const router = useRouter();
  const [disabling, setDisabling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDisable() {
    setDisabling(true);
    try {
      await disableUser(user.id);
      router.refresh();
    } finally {
      setDisabling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteUser(user.id);
      router.refresh();
      setDeleteOpen(false);
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
        disabled={isDisabled || disabling}
        onClick={handleDisable}
        title={isDisabled ? "Already disabled" : "Disable account"}
      >
        {disabling ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Ban className="size-3" />
        )}
        {isDisabled ? "Disabled" : "Disable"}
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
