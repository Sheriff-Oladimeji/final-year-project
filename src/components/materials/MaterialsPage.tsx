"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
                onChange={(e) => setYoutubeUrl(e.target.value)}
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
      {initialMaterials.length === 0 ? (
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
