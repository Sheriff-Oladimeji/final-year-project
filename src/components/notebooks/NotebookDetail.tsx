"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MoreHorizontal,
  Trash2,
  Pencil,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChatThread } from "@/components/chat/ChatThread";
import { SourcesPanel } from "./SourcesPanel";
import { renameNotebookAction, deleteNotebookAction } from "@/actions/notebooks";
import { MATERIALS_PER_NOTEBOOK_CAP } from "@/db/queries/materials";
import type { ChatMessage } from "@/lib/ai/chat-types";
import type { Notebook, Material } from "@/types";

interface NotebookDetailProps {
  notebook: Notebook;
  materials: Material[];
  initialMessages: ChatMessage[];
  initialInteractionId: string | null;
}

export function NotebookDetail({
  notebook,
  materials,
  initialMessages,
  initialInteractionId,
}: NotebookDetailProps) {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground hover:text-foreground gap-1.5">
            <Link href="/dashboard">
              <ArrowLeft className="size-3.5" />
              All notebooks
            </Link>
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <h1 className="text-sm font-semibold truncate" title={notebook.title}>
            {notebook.title}
          </h1>
        </div>

        <NotebookMenu notebook={notebook} />
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 gap-6 min-h-0">
        <SourcesPanel
          notebookId={notebook.id}
          materials={materials}
          cap={MATERIALS_PER_NOTEBOOK_CAP}
        />
        <ChatThread
          notebook={notebook}
          materials={materials}
          initialMessages={initialMessages}
          initialInteractionId={initialInteractionId}
        />
      </div>
    </div>
  );
}

function NotebookMenu({ notebook }: { notebook: Notebook }) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState(notebook.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await renameNotebookAction(notebook.id, title);
    setBusy(false);
    if ("error" in result) {
      setError(result.error ?? "Rename failed.");
    } else {
      setRenameOpen(false);
      router.refresh();
    }
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deleteNotebookAction(notebook.id);
    if (!("error" in result)) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setRenameOpen(true)}
        title="Rename notebook"
      >
        <Pencil className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setDeleteOpen(true)}
        title="Delete notebook"
      >
        <Trash2 className="size-3.5" />
      </Button>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Rename notebook</DialogTitle>
              <DialogDescription>Give your notebook a clearer name.</DialogDescription>
            </DialogHeader>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              maxLength={255}
              className="my-4"
            />
            {error && <p className="text-xs text-destructive mb-3">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete notebook?</DialogTitle>
            <DialogDescription>
              This deletes <strong>{notebook.title}</strong> and all of its sources, chats, and mastery scores. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
