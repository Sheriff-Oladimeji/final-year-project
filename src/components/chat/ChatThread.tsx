"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  BookOpen,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ask, reply } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
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

const CORRECTNESS_STYLES: Record<
  Correctness,
  { label: string; className: string }
> = {
  correct: {
    label: "Correct",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  correct_with_hint: {
    label: "Correct with hint",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  incorrect: {
    label: "Incorrect",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function CitationsAccordion({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <BookOpen className="size-3" />
        {citations.length} source{citations.length > 1 ? "s" : ""}
        {open ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {citations.map((c, i) => (
            <div key={i} className="rounded-lg bg-muted/50 p-3 text-xs">
              <p className="font-medium text-muted-foreground mb-1">
                {c.source}
              </p>
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs capitalize">
          {turn.topic}
        </Badge>
      </div>
      <div className="rounded-xl rounded-tl-sm bg-muted px-4 py-3 text-sm leading-relaxed max-w-2xl">
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
    <div className="flex flex-col items-end gap-1">
      <div className="rounded-xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 text-sm leading-relaxed max-w-2xl">
        {turn.content}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn("text-xs", style.className)}>
          {style.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {deltaSign}
          {turn.scoreDelta} pts · score {turn.newScore}/100
        </span>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ChatThread() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentInteractionId, setCurrentInteractionId] = useState<
    string | null
  >(null);
  const [phase, setPhase] = useState<"ask" | "reply">("ask");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever turns change
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
        const res = await ask(text);
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
        const res = await reply(currentInteractionId!, text);
        setTurns((prev) => [
          ...prev,
          {
            type: "reply",
            content: text,
            correctness: res.correctness,
            scoreDelta: res.score_delta,
            newScore: res.new_score,
          },
          // Immediately push the next guided question
          {
            type: "question",
            content: res.next_guided_question,
            topic: turns.findLast((t) => t.type === "question")
              ? (turns.findLast((t) => t.type === "question") as QuestionTurn)
                  .topic
              : "",
            citations: [],
            interactionId: res.next_interaction_id,
          },
        ]);
        setCurrentInteractionId(res.next_interaction_id);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError("no_materials");
      } else if (err instanceof ApiError && err.status === 429) {
        setError("You're sending questions too fast. Wait a moment and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
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
      ? "Ask a question about your course materials…"
      : "Type your answer to the guided question…";

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Thread */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">
        {turns.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
            <MessageSquare className="size-8 opacity-40" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Start learning
              </p>
              <p className="text-xs mt-0.5">
                Ask a question about your uploaded course materials.
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
            <Loader2 className="size-3 animate-spin" />
            {phase === "ask" ? "Generating guided question…" : "Scoring your answer…"}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="pb-3">
          {error === "no_materials" ? (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">
                You have no indexed materials yet.{" "}
                <Link href="/materials" className="underline underline-offset-2">
                  Upload materials
                </Link>{" "}
                first.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end pt-2 border-t border-border">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={loading}
          rows={2}
          className="resize-none flex-1 text-sm"
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading || !input.trim()}
        >
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
