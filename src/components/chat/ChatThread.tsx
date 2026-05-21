"use client";

import { useState, Fragment, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, BookOpen, AlertCircle, Loader2 } from "lucide-react";
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
import { SessionInfoSidebar } from "./SessionInfoSidebar";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/ai/chat-types";
import type { Notebook, Material, Correctness, Tier } from "@/types";

interface ChatThreadProps {
  notebook: Notebook;
  materials: Material[];
  initialMessages: ChatMessage[];
  initialInteractionId: string | null;
  mobileMasteryOpen?: boolean;
  onMobileMasteryClose?: () => void;
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
  notebook,
  materials,
  initialMessages,
  initialInteractionId,
  mobileMasteryOpen = false,
  onMobileMasteryClose,
}: ChatThreadProps) {
  const [text, setText] = useState("");
  const [interactionId, setInteractionId] = useState<string | null>(initialInteractionId);

  const readyCount = materials.filter((m) => m.status === "ready").length;
  const noReadySources = readyCount === 0;

  // Aggregate starter suggestions from all ready materials.
  const starterSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of materials) {
      if (m.status !== "ready") continue;
      for (const s of m.suggestions) {
        if (!seen.has(s)) {
          seen.add(s);
          out.push(s);
        }
      }
      if (out.length >= 4) break;
    }
    return out.slice(0, 4);
  }, [materials]);

  const { messages, sendMessage, status, error } = useChat<ChatMessage>({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onData: ({ type, data }) => {
      if (type === "data-interaction") {
        setInteractionId((data as { id: string }).id);
      } else if (type === "data-mode") {
        const mode = (data as { value: string }).value;
        if (mode === "answer" || mode === "meta") {
          setInteractionId(null);
        }
      }
    },
  });

  const { topicName, masteryScore, tier, recentCorrectness, latestSuggestions } = useMemo(() => {
    let topicName: string | null = null;
    let masteryScore: number | null = null;
    let tier: Tier | null = null;
    const recent: (Correctness | "give_up")[] = [];
    let latestSuggestions: string[] = [];

    for (const m of messages) {
      if (m.role !== "assistant") continue;
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
          latestSuggestions = part.data.items;
        }
      }
    }
    const recentCorrectness = recent.filter((c): c is Correctness => c !== "give_up");
    return { topicName, masteryScore, tier, recentCorrectness, latestSuggestions };
  }, [messages]);

  function send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed || noReadySources) return;
    sendMessage(
      { text: trimmed },
      { body: { notebookId: notebook.id, interactionId: interactionId ?? undefined } },
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

  const visibleSuggestions =
    messages.length === 0
      ? starterSuggestions
      : status === "ready"
        ? latestSuggestions
        : [];

  return (
    <div className="flex flex-1 min-w-0 gap-6">
      <div className="flex flex-1 min-w-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="px-0">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<Sparkles className="size-10 text-primary" />}
              title={
                noReadySources
                  ? "Add a source to get started"
                  : `Ask anything about ${notebook.title}`
              }
              description={
                noReadySources
                  ? "Upload at least one PDF or YouTube video on the left, then ask away."
                  : "The tutor answers from your sources, then asks a Quick check to track mastery."
              }
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

      {visibleSuggestions.length > 0 && !noReadySources && (
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
            disabled={noReadySources}
            placeholder={
              noReadySources
                ? "Add a source first to start chatting…"
                : interactionId
                  ? "Type your answer to the Quick check…"
                  : `Ask anything about ${notebook.title}…`
            }
          />
        </PromptInputBody>
        <PromptInputFooter>
          <span className="text-xs text-muted-foreground">
            Enter to send · Shift+Enter for new line
          </span>
          <PromptInputSubmit
            status={submitStatus}
            disabled={!text.trim() || noReadySources}
          />
        </PromptInputFooter>
      </PromptInput>
      </div>

      <SessionInfoSidebar
        notebookTitle={notebook.title}
        sourceCount={materials.length}
        topicName={topicName}
        masteryScore={masteryScore}
        tier={tier}
        recentCorrectness={recentCorrectness}
        mobileOpen={mobileMasteryOpen}
        onMobileClose={onMobileMasteryClose}
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

  const fullText = textChunks.join("").replace(/\[source:[^\]]*\]/gi, "").trim();

  // Split "Quick check: …" from the body so we can render it as a callout
  const quickCheckMatch = fullText.match(/Quick check:\s*([\s\S]+)$/i);
  const bodyText = quickCheckMatch
    ? fullText.slice(0, fullText.length - quickCheckMatch[0].length).trim()
    : fullText;
  const quickCheckQuestion = quickCheckMatch ? quickCheckMatch[1].trim() : null;

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
          {bodyText ? (
            <MessageResponse>{bodyText}</MessageResponse>
          ) : !quickCheckQuestion ? (
            <span className="text-sm text-muted-foreground">Thinking…</span>
          ) : null}
        </MessageContent>

        {quickCheckQuestion && (
          <div className="border-t border-border/60 pt-3 mt-1">
            <p className="text-sm text-foreground leading-snug">
              <span className="text-muted-foreground">Quick check — </span>
              {quickCheckQuestion}
            </p>
          </div>
        )}

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
