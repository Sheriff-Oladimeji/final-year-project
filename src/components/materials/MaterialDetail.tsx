"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Video, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/ChatThread";
import type { ChatMessage } from "@/lib/ai/chat-types";
import type { Material } from "@/types";

interface MaterialDetailProps {
  material: Material;
  initialMessages: ChatMessage[];
  initialInteractionId: string | null;
}

export function MaterialDetail({
  material,
  initialMessages,
  initialInteractionId,
}: MaterialDetailProps) {
  if (material.status === "ready") {
    return (
      <ChatThread
        material={material}
        initialMessages={initialMessages}
        initialInteractionId={initialInteractionId}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground hover:text-foreground gap-1.5">
        <Link href="/materials">
          <ArrowLeft className="size-3.5" />
          All materials
        </Link>
      </Button>

      <div className="flex items-center gap-3">
        <div className="text-primary">
          {material.kind === "pdf" ? <FileText className="size-5" /> : <Video className="size-5" />}
        </div>
        <h1 className="text-base font-semibold tracking-tight truncate">{material.display_name}</h1>
      </div>

      {material.status === "pending" ? (
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
