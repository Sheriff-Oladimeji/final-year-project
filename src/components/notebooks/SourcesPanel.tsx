"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Video,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
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
import { AddMaterialDialog } from "@/components/materials/AddMaterialDialog";
import { deleteMaterialAction } from "@/actions/materials";
import { cn } from "@/lib/utils";
import type { Material } from "@/types";

interface SourcesPanelProps {
  notebookId: string;
  materials: Material[];
  cap: number;
}

export function SourcesPanel({ notebookId, materials, cap }: SourcesPanelProps) {
  const count = materials.length;
  const atCap = count >= cap;
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="hidden lg:flex shrink-0 flex-col">
        <div className="rounded-xl border border-border bg-card p-2 flex flex-col items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed(false)}
            title="Show sources"
            className="text-muted-foreground hover:text-foreground"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
          <div className="flex flex-col items-center gap-1.5">
            {materials.map((m) => (
              <div key={m.id} title={m.display_name} className={cn(
                "size-1.5 rounded-full",
                m.status === "ready" ? "bg-emerald-500" : "bg-muted-foreground/40",
              )} />
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-3">
      <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sources
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs tabular-nums text-muted-foreground">
              {count}/{cap}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(true)}
              title="Hide sources"
              className="text-muted-foreground hover:text-foreground"
            >
              <PanelLeftClose className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {materials.length === 0 ? (
            <p className="text-xs text-muted-foreground px-1 py-2">
              Add a PDF or YouTube video to start chatting.
            </p>
          ) : (
            <ul className="space-y-1">
              {materials.map((m) => (
                <SourceRow key={m.id} material={m} />
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0">
          <AddMaterialDialog
            notebookId={notebookId}
            disabled={atCap}
            disabledReason={atCap ? `Limit of ${cap} sources reached` : undefined}
          />
          {atCap && (
            <p className="text-xs text-muted-foreground mt-2">
              Limit of {cap} sources reached. Delete one to add another.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function SourceRow({ material }: { material: Material }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteMaterialAction(material.id);
    if (!("error" in result)) {
      router.refresh();
    }
    setDeleting(false);
    setConfirmOpen(false);
  }

  return (
    <li className="group flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
      <div className={cn(
        "flex-shrink-0 mt-0.5",
        material.status === "ready" ? "text-primary/70" : "text-muted-foreground/60",
      )}>
        {material.kind === "pdf" ? <FileText className="size-3.5" /> : <Video className="size-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-snug truncate" title={material.display_name}>
          {material.display_name}
        </p>
        <div className="mt-0.5">
          <StatusBadge status={material.status} />
        </div>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          >
            <Trash2 className="size-3" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove source?</DialogTitle>
            <DialogDescription>
              This removes <strong>{material.display_name}</strong> from this notebook. Chats already grounded in it stay, but new chats won&apos;t reference it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function StatusBadge({ status }: { status: Material["status"] }) {
  if (status === "pending") {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px] py-0 h-4 px-1.5">
        <Loader2 className="size-2.5 animate-spin" />
        Indexing
      </Badge>
    );
  }
  if (status === "ready") {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] py-0 h-4 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
        <CheckCircle className="size-2.5" />
        Ready
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-[10px] py-0 h-4 px-1.5 bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
      <XCircle className="size-2.5" />
      Failed
    </Badge>
  );
}
