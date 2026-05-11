"use client";

import { useState, Fragment, useMemo } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowLeft, Sparkles, BookOpen, AlertCircle, Loader2 } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import {
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SessionInfoSidebar } from "./SessionInfoSidebar";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/ai/chat-types";
import type { Material, Correctness, Tier } from "@/types";

interface ChatThreadProps {
  material: Material;
  initialMessages: ChatMessage[];
  initialInteractionId: string | null;
}

const CORRECTNESS_STYLES: Record<string, { label: string; className: string }> = {
  correct: {
    label: "Correct",
    className:
      "bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  correct_with_hint: {
    label: "Correct with hint",
    className:
      "bg-amber-100/80 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  },
  incorrect: {
    label: "Incorrect",
    className:
      "bg-red-100/80 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
  },
  give_up: {
    label: "Skipped",
    className:
      "bg-slate-100/80 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800",
  },
};

export function ChatThread({
  material,
  initialMessages,
  initialInteractionId,
}: ChatThreadProps) {
  const [text, setText] = useState("");
  const [interactionId, setInteractionId] = useState<string | null>(initialInteractionId);

  const { messages, sendMessage, status, error } = useChat<ChatMessage>({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onData: ({ type, data }) => {
      if (type === "data-interaction") {
        setInteractionId((data as { id: string }).id);
      } else if (type === "data-mode") {
        // After an "answer" or "meta" turn, the next user message is fresh —
        // not a reply to a guided question. Clear the interaction pointer so
        // the server classifier handles routing.
        const mode = (data as { value: string }).value;
        if (mode === "answer" || mode === "meta") {
          // Note: this fires on every chunk; safe to set repeatedly.
          setInteractionId(null);
        }
      }
    },
  });

  // Derive sidebar state and the latest turn's suggestions.
  const { topicName, masteryScore, tier, recentCorrectness, latestSuggestions } = useMemo(() => {
    let topicName: string | null = null;
    let masteryScore: number | null = null;
    let tier: Tier | null = null;
    const recent: (Correctness | "give_up")[] = [];
    let latestSuggestions: string[] = [];

    for (const m of messages) {
      if (m.role !== "assistant") continue;
      let messageHadSuggestions: string[] | null = null;
      for (const part of m.parts) {
        if (part.type === "data-topic") {
          topicName = part.data.name;
          masteryScore = part.data.mastery_score;
          tier = part.data.tier;
        } else if (part.type === "data-score") {
          masteryScore = part.data.new_score;
          tier = part.data.new_tier;
          recent.push(part.data.correctness);
        } else if (part.type === "data-suggestions") {
          messageHadSuggestions = part.data.items;
        }
      }
      if (messageHadSuggestions) latestSuggestions = messageHadSuggestions;
    }
    // recentCorrectness for sidebar — exclude give_up from it (sidebar dots only
    // count actual answer attempts).
    const recentCorrectness = recent.filter(
      (c): c is Correctness => c !== "give_up",
    );
    return { topicName, masteryScore, tier, recentCorrectness, latestSuggestions };
  }, [messages]);

  function send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed) return;
    sendMessage(
      { text: trimmed },
      { body: { materialId: material.id, interactionId: interactionId ?? undefined } },
    );
    setText("");
  }

  function handleSubmit(message: PromptInputMessage) {
    if (message.text) send(message.text);
  }

  const submitStatus =
    status === "submitted" || status === "streaming"
      ? (status as "submitted" | "streaming")
      : status === "error"
        ? "error"
        : "ready";

  // Decide which suggestions row to show above the input.
  // - Empty thread → starter suggestions from material indexing
  // - Otherwise → contextual follow-ups from latest assistant turn
  const visibleSuggestions =
    messages.length === 0
      ? material.suggestions
      : status === "ready"
        ? latestSuggestions
        : [];

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
      {/* Chat panel */}
      <div className="flex flex-1 min-w-0 flex-col">
        <div className="mb-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 text-muted-foreground hover:text-foreground gap-1.5">
            <Link href="/materials">
              <ArrowLeft className="size-3.5" />
              All materials
            </Link>
          </Button>
        </div>

        <Conversation className="flex-1">
          <ConversationContent className="px-0">
            {messages.length === 0 && (
              <ConversationEmptyState
                icon={<Sparkles className="size-10 text-primary" />}
                title={`Ask anything about ${material.display_name}`}
                description="Your guide responds with questions calibrated to your mastery level. Stuck? Type 'I don't know' and you'll get a direct answer."
              />
            )}

            {messages.map((message) => (
              <Fragment key={message.id}>
                {message.role === "assistant" && <AssistantTurn message={message} />}
                {message.role === "user" && (
                  <Message from="user">
                    <MessageContent>
                      {message.parts.map((part, i) =>
                        part.type === "text" ? (
                          <span key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </span>
                        ) : null,
                      )}
                    </MessageContent>
                  </Message>
                )}
              </Fragment>
            ))}

            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent className="border-l-2 border-primary/40 pl-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <ThinkingDots />
                  </div>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {error && (
          <Alert variant="destructive" className="mt-3 mb-2">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs">
              Couldn&apos;t process that. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {visibleSuggestions.length > 0 && (
          <div className="mb-3">
            <Suggestions>
              {visibleSuggestions.map((s) => (
                <Suggestion key={s} suggestion={s} onClick={(v) => send(v)} />
              ))}
            </Suggestions>
          </div>
        )}

        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                interactionId
                  ? "Type your answer to the guided question…"
                  : `Ask anything about ${material.display_name}…`
              }
            />
          </PromptInputBody>
          <PromptInputFooter>
            <span className="text-xs text-muted-foreground">
              Enter to send · Shift+Enter for new line
            </span>
            <PromptInputSubmit status={submitStatus} disabled={!text.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>

      <SessionInfoSidebar
        material={material}
        topicName={topicName}
        masteryScore={masteryScore}
        tier={tier}
        recentCorrectness={recentCorrectness}
      />
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span>Thinking</span>
      <span className="inline-flex gap-0.5">
        <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
        <span className="size-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
        <span className="size-1 rounded-full bg-current animate-bounce" />
      </span>
    </span>
  );
}

function AssistantTurn({ message }: { message: ChatMessage }) {
  let topic: string | null = null;
  let citations: { source: string; excerpt: string }[] = [];
  let score: { correctness: Correctness | "give_up"; score_delta: number; new_score: number } | null = null;
  const textChunks: string[] = [];

  for (const part of message.parts) {
    if (part.type === "text") {
      textChunks.push(part.text);
    } else if (part.type === "data-topic") {
      topic = part.data.name;
    } else if (part.type === "data-citations") {
      citations = part.data.items;
    } else if (part.type === "data-score") {
      score = part.data;
    }
  }

  const text = textChunks.join("");
  const correctnessStyle = score ? CORRECTNESS_STYLES[score.correctness] : null;

  return (
    <Message from="assistant">
      <div className="flex flex-col gap-2">
        {(topic || score) && (
          <div className="flex flex-wrap items-center gap-2">
            {topic && (
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 text-xs capitalize"
              >
                {topic}
              </Badge>
            )}
            {score && correctnessStyle && (
              <>
                <Badge variant="outline" className={cn("text-xs", correctnessStyle.className)}>
                  {correctnessStyle.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {score.score_delta >= 0 ? "+" : ""}
                  {score.score_delta} pts · score {score.new_score}/100
                </span>
              </>
            )}
          </div>
        )}

        <MessageContent className="border-l-2 border-primary/40 pl-4">
          {text ? (
            <MessageResponse>{text}</MessageResponse>
          ) : (
            <span className="text-sm text-muted-foreground">Thinking…</span>
          )}
        </MessageContent>

        {citations.length > 0 && (
          <Sources>
            <SourcesTrigger count={citations.length}>
              <BookOpen className="size-3" />
              <span className="font-medium">
                {citations.length} source{citations.length > 1 ? "s" : ""}
              </span>
            </SourcesTrigger>
            <SourcesContent className="space-y-2">
              {citations.map((c, i) => (
                <div key={i} className="rounded-lg bg-muted/50 p-3 text-xs">
                  <p className="font-medium text-muted-foreground mb-1">{c.source}</p>
                  <p className="text-foreground leading-relaxed">{c.excerpt}</p>
                </div>
              ))}
            </SourcesContent>
          </Sources>
        )}
      </div>
    </Message>
  );
}
