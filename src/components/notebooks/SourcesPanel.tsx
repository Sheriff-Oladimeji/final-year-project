"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Video,
  Trash2,
  Loader2,
  XCircle,
  PanelLeft,
  X,
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
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SourcesPanel({ notebookId, materials, cap, mobileOpen = false, onMobileClose }: SourcesPanelProps) {
  const router = useRouter();
  const count = materials.length;
  const atCap = count >= cap;
  const [collapsed, setCollapsed] = useState(false);

  // Poll every 3 s while any source is indexing or ready-but-no-suggestions yet.
  // Cap at 20 polls (~60 s) to prevent infinite loops if suggestion generation fails.
  const [pollCount, setPollCount] = useState(0);
  const shouldPoll = materials.some(
    (m) => m.status === "pending" || (m.status === "ready" && m.suggestions.length === 0),
  );
  useEffect(() => {
    if (!shouldPoll || pollCount >= 20) return;
    const id = setInterval(() => {
      router.refresh();
      setPollCount((c) => c + 1);
    }, 3000);
    return () => clearInterval(id);
  }, [shouldPoll, pollCount, router]);
  // Reset cap when new materials arrive so fresh additions always get a full polling window
  const materialIds = materials.map((m) => m.id).join(",");
  useEffect(() => { setPollCount(0); }, [materialIds]);

  const panelContent = (
    <>
      {/* Add source button always at top, like NotebookLM */}
      <AddMaterialDialog
        notebookId={notebookId}
        disabled={atCap}
        disabledReason={atCap ? `Limit of ${cap} sources reached` : undefined}
      />
      {atCap && (
        <p className="text-xs text-muted-foreground">
          Limit of {cap} sources reached. Delete one to add another.
        </p>
      )}

      {materials.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 py-2">
          No sources yet. Add a PDF or YouTube video above.
        </p>
      ) : (
        <ul className="space-y-1 mt-1">
          {materials.map((m) => (
            <SourceRow key={m.id} material={m} />
          ))}
        </ul>
      )}
    </>
  );

  const mobileDrawer = mobileOpen ? (
    <MobileDrawer title={`Sources ${count}/${cap}`} onClose={onMobileClose} side="left">
      {panelContent}
    </MobileDrawer>
  ) : null;

  if (collapsed) {
    return (
      <>
        {mobileDrawer}
        <aside className="hidden lg:flex shrink-0 flex-col">
          <div className="rounded-xl border border-border bg-card p-2 flex flex-col items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(false)}
              title="Show sources"
              className="text-muted-foreground hover:text-foreground"
            >
              <PanelLeft className="size-4" />
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
      </>
    );
  }

  return (
    <>
      {mobileDrawer}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col">
        <div className="rounded-xl border border-border bg-card flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Sources</p>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{count}/{cap}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCollapsed(true)}
                title="Hide sources"
                className="text-muted-foreground hover:text-foreground"
              >
                <PanelLeft className="size-4" />
              </Button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
            {panelContent}
          </div>
        </div>
      </aside>
    </>
  );
}

interface MobileDrawerProps {
  title: string;
  side: "left" | "right";
  onClose?: () => void;
  children: React.ReactNode;
}

function MobileDrawer({ title, side, onClose, children }: MobileDrawerProps) {
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      {/* Panel */}
      <aside className={cn(
        "fixed inset-y-0 flex flex-col w-80 max-w-[85vw] bg-background shadow-2xl",
        side === "left" ? "left-0" : "right-0",
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <p className="text-sm font-semibold">{title}</p>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {children}
        </div>
      </aside>
    </div>
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
    <li className="group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors">
      {/* Kind badge — matches NotebookLM's colored icon tiles */}
      <div className={cn(
        "size-9 shrink-0 rounded-lg flex flex-col items-center justify-center gap-0.5",
        material.kind === "pdf"
          ? "bg-red-100 dark:bg-red-900/30"
          : "bg-red-100 dark:bg-red-900/30",
      )}>
        {material.kind === "pdf" ? (
          <>
            <FileText className="size-4 text-red-600 dark:text-red-400" />
            <span className="text-[8px] font-bold text-red-600 dark:text-red-400 leading-none">PDF</span>
          </>
        ) : (
          <>
            <Video className="size-4 text-red-600 dark:text-red-400" />
            <span className="text-[8px] font-bold text-red-600 dark:text-red-400 leading-none">YT</span>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate" title={material.display_name}>
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
        <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
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
