"use client";

import { Target, Zap, Brain, AlertCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Tier, Correctness } from "@/types";

interface SessionInfoSidebarProps {
  notebookTitle: string;
  sourceCount: number;
  topicName: string | null;
  masteryScore: number | null;
  tier: Tier | null;
  recentCorrectness: Correctness[];
  mobileOpen?: boolean;
  onMobileClose?: () => void;
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
  notebookTitle,
  sourceCount,
  topicName,
  masteryScore,
  tier,
  recentCorrectness,
  mobileOpen = false,
  onMobileClose,
}: SessionInfoSidebarProps) {
  const tierMeta = tier ? TIER_META[tier] : null;
  const TierIcon = tierMeta?.icon;

  const cards = (
    <>
      {/* Notebook header */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notebook</p>
        <p className="text-sm font-semibold mt-2 leading-snug break-words">{notebookTitle}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {sourceCount} source{sourceCount === 1 ? "" : "s"}
        </p>
      </div>

      {/* Mastery */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Mastery</p>
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
                <span className="text-xs text-muted-foreground">Tier range {tierMeta.range}</span>
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

      {/* Recent checks */}
      {recentCorrectness.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Recent quick checks
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            {recentCorrectness.slice(-8).map((c, i) => {
              const dot = CORRECTNESS_DOT[c];
              return (
                <span key={i} className={cn("size-2.5 rounded-full", dot.className)}
                  title={dot.title} aria-label={dot.title} />
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
          The tutor answers from your sources, then ends with a Quick check.{" "}
          Right answer <span className="text-emerald-600 font-medium">+15</span>,{" "}
          with hint <span className="text-amber-600 font-medium">+5</span>,{" "}
          wrong <span className="text-red-600 font-medium">−10</span>,{" "}
          skip <span className="text-muted-foreground font-medium">−5</span>.
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div className="fixed inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="fixed inset-y-0 right-0 flex flex-col w-80 max-w-[85vw] bg-background shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <p className="text-sm font-semibold">Mastery</p>
              <Button variant="ghost" size="icon-sm" onClick={onMobileClose}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {cards}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop panel */}
      <aside className="hidden xl:flex w-72 shrink-0 flex-col gap-3 overflow-y-auto">
        {cards}
      </aside>
    </>
  );
}
