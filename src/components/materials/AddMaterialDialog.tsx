"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, Video, Loader2, FilePlus2, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { uploadMaterialAction, submitYoutubeAction } from "@/actions/materials";
import { MATERIAL_UPLOAD_ACCEPT } from "@/lib/materials";

// Vercel caps function request bodies at ~4.5 MB on every plan. We keep a 4 MB
// ceiling to stay safely under it and give a clear message before uploading.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

interface AddMaterialDialogProps {
  notebookId: string;
  trigger?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  // How many more sources this notebook can accept (cap - current count).
  // Undefined means "unknown" — batches are only truncated when this is set.
  remainingSlots?: number;
}

export function AddMaterialDialog({
  notebookId,
  trigger,
  disabled,
  disabledReason,
  remainingSlots,
}: AddMaterialDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [submittingVideo, setSubmittingVideo] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFileError(null);
    setYoutubeError(null);
    setYoutubeUrl("");
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenChange(next: boolean) {
    if (disabled) return;
    if (!uploadingFile && !submittingVideo) {
      setOpen(next);
      if (!next) reset();
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setFileError(null);

    // Validate every file's size up front, before any upload starts — never
    // begin uploading a file we already know will be rejected.
    const tooLarge = selected.filter((f) => f.size > MAX_UPLOAD_BYTES);
    let toUpload = selected.filter((f) => f.size <= MAX_UPLOAD_BYTES);

    let skippedForCap = 0;
    if (remainingSlots !== undefined && toUpload.length > remainingSlots) {
      skippedForCap = toUpload.length - Math.max(remainingSlots, 0);
      toUpload = toUpload.slice(0, Math.max(remainingSlots, 0));
    }

    const notices: string[] = [];
    if (tooLarge.length > 0) {
      notices.push(
        `Skipped (over 4 MB): ${tooLarge.map((f) => f.name).join(", ")}`,
      );
    }
    if (skippedForCap > 0) {
      notices.push(
        `Skipped ${skippedForCap} file${skippedForCap > 1 ? "s" : ""} — not enough room left in this notebook.`,
      );
    }

    if (toUpload.length === 0) {
      setFileError(notices.join(" ") || "No valid files to upload.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploadingFile(true);
    const failed: string[] = [];
    try {
      for (let i = 0; i < toUpload.length; i++) {
        setUploadProgress({ done: i, total: toUpload.length });
        const file = toUpload[i];
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("notebookId", notebookId);
          const result = await uploadMaterialAction(formData);
          if ("error" in result) {
            failed.push(`${file.name}: ${result.error ?? "upload failed"}`);
            // A cap error means every remaining file will fail the same way.
            if (result.error?.toLowerCase().includes("limit")) break;
          }
        } catch {
          failed.push(`${file.name}: upload failed`);
        }
      }

      const allNotices = [...notices, ...failed].join(" ");
      if (allNotices) {
        setFileError(allNotices);
      }
      if (failed.length < toUpload.length) {
        // At least one file succeeded — reflect it, but keep the dialog open
        // if there's something the student should read first.
        router.refresh();
        if (!allNotices) {
          setOpen(false);
          reset();
        }
      }
    } finally {
      setUploadingFile(false);
      setUploadProgress(null);
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
      formData.append("notebookId", notebookId);
      const result = await submitYoutubeAction(formData);
      if ("error" in result) {
        setYoutubeError(result.error ?? "Failed to add video.");
      } else {
        // Close immediately — sidebar will show Indexing while Gemini processes
        setOpen(false);
        reset();
        router.refresh();
      }
    } catch {
      setYoutubeError("Failed to add video. Check the URL and try again.");
    } finally {
      setSubmittingVideo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            className="gap-1.5"
            disabled={disabled}
            title={disabled ? disabledReason : undefined}
          >
            <Plus className="size-4" />
            Add source
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new source</DialogTitle>
          <DialogDescription>
            Upload a document or add a YouTube video. Gemini will index it for your notebook.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="document" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="document" className="gap-1.5">
              <FileText className="size-3.5" />
              Document
            </TabsTrigger>
            <TabsTrigger value="youtube" className="gap-1.5">
              <Video className="size-3.5" />
              YouTube
            </TabsTrigger>
          </TabsList>

          <TabsContent value="document" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              Max 4 MB each. PDF, DOCX, TXT, or Markdown — select multiple files at once.
            </p>
            {fileError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{fileError}</AlertDescription>
              </Alert>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={MATERIAL_UPLOAD_ACCEPT}
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploadingFile}
            />
            <button
              type="button"
              disabled={uploadingFile}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {uploadingFile ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  <span>
                    {uploadProgress
                      ? `Uploading ${Math.min(uploadProgress.done + 1, uploadProgress.total)} of ${uploadProgress.total}…`
                      : "Uploading…"}
                  </span>
                </>
              ) : (
                <>
                  <FilePlus2 className="size-5" />
                  <span>Click to choose files</span>
                </>
              )}
            </button>
          </TabsContent>

          <TabsContent value="youtube" className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground">
              Video must have captions enabled.
            </p>
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
                className="text-sm"
              />
              <Button
                type="submit"
                disabled={submittingVideo || !youtubeUrl.trim()}
                className="w-full"
              >
                {submittingVideo ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Add video
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
