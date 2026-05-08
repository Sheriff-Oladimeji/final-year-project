"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Video, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChatThread } from "@/components/chat/ChatThread";
import { deleteMaterialAction } from "@/actions/materials";
import type { Material } from "@/types";

interface MaterialDetailProps {
  material: Material;
}

export function MaterialDetail({ material }: MaterialDetailProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteMaterialAction(material.id);
    if (!("error" in result)) {
      router.push("/materials");
      router.refresh();
    } else {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground -ml-2">
          <Link href="/materials" aria-label="Back to materials">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>

        <div className="flex-shrink-0 text-primary">
          {material.kind === "pdf" ? <FileText className="size-5" /> : <Video className="size-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold tracking-tight truncate">{material.display_name}</h1>
          <p className="text-xs text-muted-foreground truncate">{material.source_uri}</p>
        </div>

        <StatusBadge status={material.status} />

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete material?</DialogTitle>
              <DialogDescription>
                This removes <strong>{material.display_name}</strong> from Gemini and your account. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Body */}
      {material.status === "ready" ? (
        <ChatThread
          materialId={material.id}
          materialName={material.display_name}
          suggestions={material.suggestions}
        />
      ) : material.status === "pending" ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-7 animate-spin text-primary" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Indexing in progress</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Gemini is processing this material. Refresh in a moment to start chatting.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 py-20 text-center">
          <div className="flex flex-col items-center gap-4">
            <XCircle className="size-7 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">Indexing failed</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                This material couldn&apos;t be indexed. Try deleting it and adding it again.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Material["status"] }) {
  if (status === "pending") {
    return (
      <Badge variant="secondary" className="gap-1 text-xs">
        <Loader2 className="size-3 animate-spin" />
        Indexing
      </Badge>
    );
  }
  if (status === "ready") {
    return (
      <Badge variant="outline" className="gap-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
        <CheckCircle className="size-3" />
        Ready
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
      <XCircle className="size-3" />
      Failed
    </Badge>
  );
}
