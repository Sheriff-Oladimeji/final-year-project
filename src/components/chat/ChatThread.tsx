"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { askAction, replyAction } from "@/actions/chat";
import type { Citation, Correctness } from "@/types";
import { cn } from "@/lib/utils";

// ── Turn types ──────────────────────────────────────────────────────────────

type QuestionTurn = {
  type: "question";
  content: string;
  topic: string;
  citations: Citation[];
  interactionId: string;
};

type ReplyTurn = {
  type: "reply";
  content: string;
  correctness: Correctness;
  scoreDelta: number;
  newScore: number;
};

type Turn = QuestionTurn | ReplyTurn;

// ── Correctness display ─────────────────────────────────────────────────────

const CORRECTNESS_STYLES: Record<Correctness, { label: string; className: string }> = {
  correct: {
    label: "Correct",
    className: "bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  correct_with_hint: {
    label: "Correct with hint",
    className: "bg-amber-100/80 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  },
  incorrect: {
    label: "Incorrect",
    className: "bg-red-100/80 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function CitationsAccordion({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        onClick={() => setOpen((o) => !o)}
      >
        <BookOpen className="size-3" />
        {citations.length} source{citations.length > 1 ? "s" : ""}
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {citations.map((c, i) => (
            <div key={i} className="rounded-lg bg-muted/50 p-3 text-xs">
              <p className="font-medium text-muted-foreground mb-1">{c.source}</p>
              <p className="text-foreground leading-relaxed">{c.excerpt}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionBubble({ turn }: { turn: QuestionTurn }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs capitalize bg-primary/10 text-primary border-primary/20">
          {turn.topic}
        </Badge>
      </div>
      <div className="rounded-xl rounded-tl-sm border-l-2 border-primary/40 bg-muted px-4 py-3 text-sm leading-relaxed max-w-2xl">
        {turn.content}
      </div>
      <CitationsAccordion citations={turn.citations} />
    </div>
  );
}

function ReplyBubble({ turn }: { turn: ReplyTurn }) {
  const style = CORRECTNESS_STYLES[turn.correctness];
  const deltaSign = turn.scoreDelta >= 0 ? "+" : "";
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="rounded-xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed max-w-2xl">
        {turn.content}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn("text-xs", style.className)}>
          {style.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {deltaSign}{turn.scoreDelta} pts · score {turn.newScore}/100
        </span>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface ChatThreadProps {
  materialId: string;
  materialName: string;
}

export function ChatThread({ materialId, materialName }: ChatThreadProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentInteractionId, setCurrentInteractionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"ask" | "reply">("ask");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setLoading(true);

    try {
      if (phase === "ask") {
        const result = await askAction(text, materialId);
        if ("error" in result) {
          setError(result.error ?? "Something went wrong.");
          return;
        }
        const res = result.data;
        setTurns((prev) => [
          ...prev,
          {
            type: "question",
            content: res.guided_question,
            topic: res.topic,
            citations: res.citations,
            interactionId: res.interaction_id,
          },
        ]);
        setCurrentInteractionId(res.interaction_id);
        setPhase("reply");
      } else {
        const result = await replyAction(currentInteractionId!, text, materialId);
        if ("error" in result) {
          setError(result.error ?? "Something went wrong.");
          return;
        }
        const res = result.data;
        const prevTopic = turns.findLast((t) => t.type === "question") as QuestionTurn | undefined;
        setTurns((prev) => [
          ...prev,
          {
            type: "reply",
            content: text,
            correctness: res.correctness,
            scoreDelta: res.score_delta,
            newScore: res.new_score,
          },
          {
            type: "question",
            content: res.next_guided_question,
            topic: prevTopic?.topic ?? "",
            citations: [],
            interactionId: res.next_interaction_id,
          },
        ]);
        setCurrentInteractionId(res.next_interaction_id);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  const placeholder =
    phase === "ask"
      ? `Ask a question about ${materialName}…`
      : "Type your answer to the guided question…";

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Thread */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">
        {turns.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-5 px-4">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <p className="text-sm font-semibold text-foreground">
                Ask anything about <span className="text-primary">{materialName}</span>
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your guide responds with questions calibrated to your mastery level (recall, application, analysis) instead of direct answers. Reply to each one and your score updates.
              </p>
            </div>
          </div>
        )}

        {turns.map((turn, i) =>
          turn.type === "question" ? (
            <QuestionBubble key={i} turn={turn} />
          ) : (
            <ReplyBubble key={i} turn={turn} />
          ),
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin text-primary" />
            {phase === "ask" ? "Generating guided question…" : "Scoring your answer…"}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="pb-3">
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end pt-3 border-t border-border">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          rows={2}
          className="resize-none flex-1 text-sm"
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground mt-1.5 text-center">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
