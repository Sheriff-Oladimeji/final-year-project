"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, Video, Trash2, Loader2, CheckCircle, XCircle, Upload, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { uploadPdfAction, submitYoutubeAction, deleteMaterialAction } from "@/actions/materials";
import type { Material } from "@/types";

interface MaterialsPageProps {
  initialMaterials: Material[];
}

export function MaterialsPage({ initialMaterials }: MaterialsPageProps) {
  const router = useRouter();
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [submittingVideo, setSubmittingVideo] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfError(null);
    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadPdfAction(formData);
      if ("error" in result) {
        setPdfError(result.error ?? "Upload failed.");
      } else {
        router.refresh();
      }
    } catch {
      setPdfError("Upload failed. Please try again.");
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleVideoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setYoutubeError(null);
    setSubmittingVideo(true);
    try {
      const formData = new FormData();
      formData.append("url", youtubeUrl);
      const result = await submitYoutubeAction(formData);
      if ("error" in result) {
        setYoutubeError(result.error ?? "Failed to add video.");
      } else {
        setYoutubeUrl("");
        router.refresh();
      }
    } catch {
      setYoutubeError("Failed to add video. Check the URL and try again.");
    } finally {
      setSubmittingVideo(false);
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteMaterialAction(id);
    if (!("error" in result)) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Materials</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload PDFs or YouTube videos — Gemini will index them for your chat sessions.
        </p>
      </div>

      {/* Upload section */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* PDF upload */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-primary" />
            Upload PDF
          </div>
          <p className="text-xs text-muted-foreground">Max 25 MB. Must be a valid PDF file.</p>
          {pdfError && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{pdfError}</AlertDescription>
            </Alert>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            id="pdf-input"
            onChange={handlePdfUpload}
            disabled={uploadingPdf}
          />
          <button
            type="button"
            disabled={uploadingPdf}
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            {uploadingPdf ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <FilePlus2 className="size-5" />
                <span>Click to choose file</span>
              </>
            )}
          </button>
        </div>

        {/* YouTube */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Video className="size-4 text-primary" />
            Add YouTube video
          </div>
          <p className="text-xs text-muted-foreground">Video must have captions enabled.</p>
          {youtubeError && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{youtubeError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleVideoSubmit} className="space-y-2">
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              required
              disabled={submittingVideo}
              className="text-xs"
            />
            <Button size="sm" type="submit" disabled={submittingVideo} className="w-full">
              {submittingVideo ? (
                <><Loader2 className="size-4 animate-spin" /> Adding…</>
              ) : (
                <><Upload className="size-4" /> Add video</>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Materials list */}
      {initialMaterials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium">No materials yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload a PDF or add a YouTube video above to get started.
          </p>
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
      <div className="flex-shrink-0 text-primary/60">
        {material.kind === "pdf" ? (
          <FileText className="size-4" />
        ) : (
          <Video className="size-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{material.display_name}</p>
        <p className="text-xs text-muted-foreground truncate">{material.source_uri}</p>
      </div>
      <StatusBadge status={material.status} />
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
