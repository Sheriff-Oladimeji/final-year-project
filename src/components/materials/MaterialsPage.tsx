"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Video, Trash2, Loader2, CheckCircle, XCircle, MessageSquare, Library } from "lucide-react";
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
import { deleteMaterialAction } from "@/actions/materials";
import { AddMaterialDialog } from "./AddMaterialDialog";
import type { Material } from "@/types";

interface MaterialsPageProps {
  initialMaterials: Material[];
}

export function MaterialsPage({ initialMaterials }: MaterialsPageProps) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const result = await deleteMaterialAction(id);
    if (!("error" in result)) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Materials</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your indexed PDFs and YouTube videos. Gemini uses these as the source for your chat sessions.
          </p>
        </div>
        <AddMaterialDialog />
      </div>

      {initialMaterials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Library className="size-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">No materials yet</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Add your first PDF or YouTube video to get started.
              </p>
            </div>
            <AddMaterialDialog />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">
            Your materials
          </p>
          <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {initialMaterials.map((m) => (
              <MaterialRow key={m.id} material={m} onDelete={handleDelete} />
            ))}
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

function MaterialRow({
  material,
  onDelete,
}: {
  material: Material;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    await onDelete(material.id);
    setOpen(false);
    setDeleting(false);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <Link
        href={`/materials/${material.id}`}
        className="flex flex-1 items-center gap-3 min-w-0 -my-1 py-1 group"
      >
        <div className="flex-shrink-0 text-primary/60 group-hover:text-primary transition-colors">
          {material.kind === "pdf" ? (
            <FileText className="size-4" />
          ) : (
            <Video className="size-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {material.display_name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{material.source_uri}</p>
        </div>
      </Link>
      <StatusBadge status={material.status} />
      {material.status === "ready" && (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 text-primary border-primary/30 hover:bg-primary/10 hover:text-primary"
        >
          <Link href={`/materials/${material.id}`}>
            <MessageSquare className="size-3.5" />
            Open
          </Link>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive cursor-pointer">
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
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
