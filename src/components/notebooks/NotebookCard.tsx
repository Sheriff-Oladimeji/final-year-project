"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Book, FileText, Brain, MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renameNotebookAction, deleteNotebookAction } from "@/actions/notebooks";
import type { Notebook } from "@/types";

interface NotebookCardProps {
  notebook: Notebook;
  sourceCount: number;
  topicCount: number;
  averageMastery: number | null;
}

export function NotebookCard({
  notebook,
  sourceCount,
  topicCount,
  averageMastery,
}: NotebookCardProps) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(notebook.title);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  async function handleRename() {
    if (!renameValue.trim() || renameValue.trim() === notebook.title) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    setRenameError(null);
    const result = await renameNotebookAction(notebook.id, renameValue);
    setRenaming(false);
    if ("error" in result) {
      setRenameError(result.error ?? "Something went wrong.");
    } else {
      setRenameOpen(false);
      router.refresh();
    }
  }

  async function handleDelete() {
    setDeleting(true);
    await deleteNotebookAction(notebook.id);
    setDeleting(false);
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <Card
        className="h-full hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer group"
        onClick={() => router.push(`/notebooks/${notebook.id}`)}
      >
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
              <Book className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {notebook.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Updated {timeAgo(notebook.updated_at)}
              </p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity -mt-1 -mr-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameValue(notebook.title);
                    setRenameError(null);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="size-3.5 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="size-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FileText className="size-3.5" />
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Brain className="size-3.5" />
              {topicCount} topic{topicCount === 1 ? "" : "s"}
            </span>
          </div>

          {averageMastery !== null && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 text-xs tabular-nums"
              >
                {averageMastery} / 100
              </Badge>
              <span className="text-xs text-muted-foreground">avg mastery</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename notebook</DialogTitle>
            <DialogDescription>Enter a new name for this notebook.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
            maxLength={255}
            autoFocus
          />
          {renameError && <p className="text-xs text-destructive">{renameError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={renaming || !renameValue.trim()}>
              {renaming ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete notebook?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{notebook.title}</strong> and all its sources and chat history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
