"use client";

import { Target, Zap, Brain, Circle, AlertCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Tier, Correctness, NotebookTopicStatus } from "@/types";

interface SessionInfoSidebarProps {
  notebookTitle: string;
  sourceCount: number;
  topics: NotebookTopicStatus[];
  currentTopicName: string | null;
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

// Kept separate from TIER_META/Tier — "not started" is a UI display state
// for a taxonomy-seeded topic the student hasn't asked about yet, not a
// mastery tier used anywhere else in the codebase.
const NOT_STARTED_META = {
  label: "Not started",
  icon: Circle,
  className: "bg-muted text-muted-foreground border-border",
};

const CORRECTNESS_DOT: Record<Correctness, { className: string; title: string }> = {
  correct: { className: "bg-emerald-500", title: "Correct" },
  correct_with_hint: { className: "bg-amber-500", title: "Partially correct" },
  incorrect: { className: "bg-red-500", title: "Incorrect" },
};

function TopicRow({ topic, isCurrent }: { topic: NotebookTopicStatus; isCurrent: boolean }) {
  const meta = topic.has_interacted ? TIER_META[topic.tier] : NOT_STARTED_META;
  const Icon = meta.icon;
  return (
    <div className={cn("rounded-lg border p-2.5", isCurrent ? "border-primary/40 bg-primary/5" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium capitalize truncate">{topic.name}</p>
        <Badge variant="outline" className={cn("gap-1 text-[10px] shrink-0", meta.className)}>
          <Icon className="size-2.5" />
          {meta.label}
        </Badge>
      </div>
      {/* No number rendered anywhere in this row — the bar's fill is the
          only signal of progress within a tier, deliberately not paired
          with a digit or a title tooltip. */}
      <Progress value={topic.has_interacted ? topic.mastery_score : 0} className="mt-2 h-1" />
    </div>
  );
}

export function SessionInfoSidebar({
  notebookTitle,
  sourceCount,
  topics,
  currentTopicName,
  recentCorrectness,
  mobileOpen = false,
  onMobileClose,
}: SessionInfoSidebarProps) {
  const cards = (
    <>
      {/* Topics */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Topics</p>
        {topics.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2 max-h-80 overflow-y-auto">
            {topics.map((t) => (
              <TopicRow key={t.id} topic={t} isCurrent={t.name === currentTopicName} />
            ))}
          </div>
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
            {recentCorrectness.filter((c) => c === "correct_with_hint").length} partial ·{" "}
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
          The tutor answers from your sources, then ends with a Quick check.
          Answer well and you&apos;ll move on to harder material faster; miss
          one and you&apos;ll get another shot at the same idea before moving on.
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
              <p className="text-sm font-semibold">Topics</p>
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
      <aside className="hidden xl:flex w-64 shrink-0 flex-col gap-3 overflow-y-auto">
        {cards}
      </aside>
    </>
  );
}
