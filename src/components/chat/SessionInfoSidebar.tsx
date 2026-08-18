"use client";

import { useState } from "react";
import { AlertCircle, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Tier, Correctness, NotebookTopicStatus } from "@/types";

interface SessionInfoSidebarProps {
  notebookTitle: string;
  sourceCount: number;
  topics: NotebookTopicStatus[];
  // Distinguishes "nothing extracted yet, still running" from "genuinely
  // idle" — without this the empty state reads as if the notebook has no
  // topics at all during the (up to several seconds) window right after
  // upload while taxonomy extraction is still in flight.
  topicsExtracting: boolean;
  currentTopicName: string | null;
  recentCorrectness: Correctness[];
  // Populates the chat input with a topic-scoped prompt (e.g. "Teach me X"
  // or "Quiz me on X again") WITHOUT sending it — the student can edit it
  // before hitting send themselves. Omitted while a topic taxonomy hasn't
  // loaded yet (no rows to act on).
  onTopicAction?: (topic: NotebookTopicStatus) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

// No text badge, no icon — both were tried and both tested as either
// confusing (icon: "no idea what it means") or crowding out the title
// (badge: forced aggressive truncation on longer topic names). The bar's
// color now carries the tier on its own — Tailwind's arbitrary-variant
// syntax targets Progress's inner indicator from outside the primitive
// (components/ui is shadcn-owned, not edited directly).
const TIER_BAR_CLASS: Record<Tier, string> = {
  recall: "[&>[data-slot=progress-indicator]]:bg-primary",
  application: "[&>[data-slot=progress-indicator]]:bg-amber-500",
  analysis: "[&>[data-slot=progress-indicator]]:bg-emerald-500",
};

const NOT_STARTED_BAR_CLASS = "[&>[data-slot=progress-indicator]]:bg-muted-foreground/25";

const CORRECTNESS_DOT: Record<Correctness, { className: string; title: string }> = {
  correct: { className: "bg-emerald-500", title: "Correct" },
  correct_with_hint: { className: "bg-amber-500", title: "Partially correct" },
  incorrect: { className: "bg-red-500", title: "Incorrect" },
};

function TopicRow({
  topic,
  isCurrent,
  onAction,
}: {
  topic: NotebookTopicStatus;
  isCurrent: boolean;
  onAction?: (topic: NotebookTopicStatus) => void;
}) {
  const barClass = topic.has_interacted ? TIER_BAR_CLASS[topic.tier] : NOT_STARTED_BAR_CLASS;
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 transition-colors duration-200",
        isCurrent ? "border-primary/40 bg-primary/5" : "border-border bg-transparent",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium capitalize truncate">{topic.name}</p>
        {onAction && (
          <button
            type="button"
            onClick={() => onAction(topic)}
            className="shrink-0 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          >
            {topic.has_interacted ? "Recall" : "Learn"}
          </button>
        )}
      </div>
      {/* No number rendered anywhere in this row — the bar's fill and color
          are the only signal, deliberately not paired with a digit, a text
          badge, or a title tooltip. */}
      <Progress
        value={topic.has_interacted ? topic.mastery_score : 0}
        className={cn("mt-2 h-1.5", barClass)}
      />
    </div>
  );
}

export function SessionInfoSidebar({
  notebookTitle,
  sourceCount,
  topics,
  topicsExtracting,
  currentTopicName,
  recentCorrectness,
  onTopicAction,
  mobileOpen = false,
  onMobileClose,
}: SessionInfoSidebarProps) {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  // Topics is the primary panel and claims all available height (flex-1) so
  // the list doesn't shrink-wrap to a handful of rows and leave dead space
  // below it — the second most common complaint after the icon confusion.
  // Recent checks stays compact and fixed-height below it.
  const cards = (
    <>
      <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Topics</p>
            {topics.length > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {topics.filter((t) => t.has_interacted).length}/{topics.length}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-5 -mr-1 text-muted-foreground hover:text-foreground"
            onClick={() => setHowItWorksOpen(true)}
            title="How this works"
          >
            <HelpCircle className="size-3.5" />
          </Button>
        </div>
        {topics.length > 0 ? (
          <div className="mt-3 flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto">
            {topics.map((t) => (
              <TopicRow key={t.id} topic={t} isCurrent={t.name === currentTopicName} onAction={onTopicAction} />
            ))}
          </div>
        ) : topicsExtracting ? (
          <div className="mt-3 flex flex-col gap-2" aria-label="Extracting topics">
            {[100, 85, 92].map((w, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5">
                <Skeleton className="h-3" style={{ width: `${w}%` }} />
                <Skeleton className="mt-2 h-1.5 w-full" />
              </div>
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
        <div className="shrink-0 rounded-xl border border-border bg-card p-4">
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
    </>
  );

  return (
    <>
      <Dialog open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How this works</DialogTitle>
            <DialogDescription asChild>
              <p className="leading-relaxed">
                The tutor answers from your sources, then ends with a Quick
                check. Answer well and you&apos;ll move on to harder material
                faster; miss one and you&apos;ll get another shot at the same
                idea before moving on.
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

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
            <div className="flex-1 min-h-0 p-4 flex flex-col gap-3">
              {cards}
            </div>
          </aside>
        </div>
      )}

      {/* Desktop panel */}
      <aside className="hidden xl:flex w-64 shrink-0 min-h-0 flex-col gap-3">
        {cards}
      </aside>
    </>
  );
}
