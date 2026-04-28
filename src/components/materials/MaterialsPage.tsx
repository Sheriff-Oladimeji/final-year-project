"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Video, Trash2, Loader2, CheckCircle, XCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  listMaterials,
  uploadPdf,
  submitYoutube,
  deleteMaterial,
} from "@/lib/api/materials";
import { ApiError } from "@/lib/api/client";
import type { Material } from "@/types";

export function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [youtubeUrl, setVideoUrl] = useState("");
  const [submittingVideo, setSubmittingVideo] = useState(false);
  const [youtubeError, setVideoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // IDs of materials that are still pending — we poll until they settle
  const pendingIds = materials.filter((m) => m.status === "pending").map((m) => m.id);

  async function fetchMaterials() {
    try {
      const data = await listMaterials();
      setMaterials(data);
    } catch {
      // Silently fail on background refresh
    }
  }

  useEffect(() => {
    listMaterials()
      .then(setMaterials)
      .finally(() => setLoadingInitial(false));
  }, []);

  // Poll every 3s while any material is pending
  useEffect(() => {
    if (pendingIds.length === 0) return;
    const id = setInterval(fetchMaterials, 3000);
    return () => clearInterval(id);
  }, [pendingIds.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfError(null);
    setUploadingPdf(true);
    try {
      const material = await uploadPdf(file);
      setMaterials((prev) => [material, ...prev]);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleVideoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setVideoError(null);
    setSubmittingVideo(true);
    try {
      const material = await submitYoutube(youtubeUrl);
      setMaterials((prev) => [material, ...prev]);
      setVideoUrl("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setVideoError("Could not extract transcript. Make sure the video has captions enabled.");
      } else {
        setVideoError("Failed to add video. Check the URL and try again.");
      }
    } finally {
      setSubmittingVideo(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch {
      // Could show a toast here
    }
  }

  if (loadingInitial) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Materials</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Upload PDFs or YouTube videos — Gemini will index them for your chat sessions.
        </p>
      </div>

      {/* Upload section */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* PDF upload */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4" />
              Upload PDF
            </div>
            <p className="text-xs text-muted-foreground">Max 25 MB. Must be a valid PDF.</p>
            {pdfError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{pdfError}</AlertDescription>
              </Alert>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                id="pdf-input"
                onChange={handlePdfUpload}
                disabled={uploadingPdf}
              />
              <Button
                asChild={false}
                variant="outline"
                size="sm"
                disabled={uploadingPdf}
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                {uploadingPdf ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Choose file
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* YouTube */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Video className="size-4" />
              Add YouTube video
            </div>
            <p className="text-xs text-muted-foreground">Video must have captions enabled.</p>
            {youtubeError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{youtubeError}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleVideoSubmit} className="flex gap-2">
              <Input
                value={youtubeUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                required
                disabled={submittingVideo}
                className="text-xs"
              />
              <Button size="sm" type="submit" disabled={submittingVideo}>
                {submittingVideo ? <Loader2 className="size-4 animate-spin" /> : "Add"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Materials list */}
      {materials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium">No materials yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload a PDF or add a YouTube video above to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Your materials
          </Label>
          <div className="divide-y divide-border rounded-xl border border-border">
            {materials.map((m) => (
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
      <Badge variant="outline" className="gap-1 text-xs text-green-700 border-green-200 bg-green-50">
        <CheckCircle className="size-3" />
        Ready
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs text-red-700 border-red-200 bg-red-50">
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
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-shrink-0 text-muted-foreground">
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
