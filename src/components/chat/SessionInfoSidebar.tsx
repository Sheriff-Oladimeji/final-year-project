"use client";

import {
  FileText,
  Video,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  Target,
  Zap,
  Brain,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMaterialAction } from "@/actions/materials";
import { cn } from "@/lib/utils";
import type { Material, Tier, Correctness } from "@/types";

interface SessionInfoSidebarProps {
  material: Material;
  topicName: string | null;
  masteryScore: number | null;
  tier: Tier | null;
  recentCorrectness: Correctness[];
}

const TIER_META: Record<Tier, { label: string; range: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  recall: {
    label: "Recall",
    range: "0–30",
    icon: Target,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  application: {
    label: "Application",
    range: "31–60",
    icon: Zap,
    className: "bg-amber-100/80 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  },
  analysis: {
    label: "Analysis",
    range: "61–100",
    icon: Brain,
    className: "bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
};

const CORRECTNESS_DOT: Record<Correctness, { className: string; title: string }> = {
  correct: { className: "bg-emerald-500", title: "Correct" },
  correct_with_hint: { className: "bg-amber-500", title: "Correct with hint" },
  incorrect: { className: "bg-red-500", title: "Incorrect" },
};

export function SessionInfoSidebar({
  material,
  topicName,
  masteryScore,
  tier,
  recentCorrectness,
}: SessionInfoSidebarProps) {
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

  const tierMeta = tier ? TIER_META[tier] : null;
  const TierIcon = tierMeta?.icon;

  return (
    <aside className="hidden lg:flex w-80 shrink-0 flex-col gap-4">
      {/* Material card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Material
          </p>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive -mt-1 -mr-1">
                <Trash2 className="size-3.5" />
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

        <div className="mt-3 flex items-start gap-2.5">
          <div className="flex-shrink-0 text-primary mt-0.5">
            {material.kind === "pdf" ? <FileText className="size-4" /> : <Video className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug break-words">
              {material.display_name}
            </p>
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              {material.kind === "pdf" ? "PDF document" : "YouTube video"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
          >
            <CheckCircle className="size-3" />
            Indexed
          </Badge>
        </div>
      </div>

      {/* Mastery card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Mastery
        </p>

        {topicName && masteryScore !== null && tier ? (
          <>
            <p className="mt-3 text-sm font-medium capitalize">{topicName}</p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">{masteryScore}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>

            <Progress value={masteryScore} className="mt-2 h-1.5" />

            {tierMeta && TierIcon && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className={cn("gap-1 text-xs", tierMeta.className)}>
                  <TierIcon className="size-3" />
                  {tierMeta.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Tier range {tierMeta.range}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="size-3.5" />
            Ask a question to start tracking mastery
          </div>
        )}
      </div>

      {/* Recent answers */}
      {recentCorrectness.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recent answers
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            {recentCorrectness.slice(-8).map((c, i) => {
              const dot = CORRECTNESS_DOT[c];
              return (
                <span
                  key={i}
                  className={cn("size-2.5 rounded-full", dot.className)}
                  title={dot.title}
                  aria-label={dot.title}
                />
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {recentCorrectness.filter((c) => c === "correct").length} correct ·{" "}
            {recentCorrectness.filter((c) => c === "correct_with_hint").length} with hints ·{" "}
            {recentCorrectness.filter((c) => c === "incorrect").length} missed
          </p>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-dashed border-border p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          How this works
        </p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Your guide responds with questions instead of answers. Right answer: <span className="text-emerald-600 font-medium">+15</span>. With hint: <span className="text-amber-600 font-medium">+5</span>. Incorrect: <span className="text-red-600 font-medium">−10</span>.
        </p>
      </div>
    </aside>
  );
}
