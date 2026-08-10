"use client";

import { useState, Fragment, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, BookOpen, AlertCircle, FileText } from "lucide-react";
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
    label: "Partially correct",
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
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const readyCount = materials.filter((m) => m.status === "ready").length;
  const noReadySources = readyCount === 0;

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
      } else if (type === "data-suggestions") {
        setSuggestions((data as { items: string[] }).items);
      }
    },
  });

  const { topicName, masteryScore, tier, recentCorrectness } = useMemo(() => {
    let topicName: string | null = null;
    let masteryScore: number | null = null;
    let tier: Tier | null = null;
    const recent: (Correctness | "give_up")[] = [];

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
        }
      }
    }
    const recentCorrectness = recent.filter((c): c is Correctness => c !== "give_up");
    return { topicName, masteryScore, tier, recentCorrectness };
  }, [messages]);

  function send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed || noReadySources) return;
    setSuggestions([]);
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

  return (
    <div className="flex flex-1 min-w-0 min-h-0 gap-6">
      <div className="flex flex-1 min-w-0 min-h-0 flex-col">
      <Conversation className="flex-1 min-h-0">
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
              <TypingBubble />
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

      {suggestions.length > 0 && status === "ready" && (
        <div className="flex flex-wrap gap-2 mb-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              {s}
            </button>
          ))}
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
                  ? "Answer the Quick check, or ask something else…"
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

function TypingBubble() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3.5 rounded-2xl rounded-tl-sm bg-muted w-fit">
      <span className="size-2 rounded-full bg-foreground/50 [animation:typing-dot_1.2s_ease-in-out_infinite] [animation-delay:0s]" />
      <span className="size-2 rounded-full bg-foreground/50 [animation:typing-dot_1.2s_ease-in-out_infinite] [animation-delay:0.2s]" />
      <span className="size-2 rounded-full bg-foreground/50 [animation:typing-dot_1.2s_ease-in-out_infinite] [animation-delay:0.4s]" />
    </div>
  );
}

function AssistantTurn({ message }: { message: ChatMessage }) {
  let topic: string | null = null;
  let score: { correctness: Correctness | "give_up"; score_delta: number; new_score: number } | null = null;
  const textChunks: string[] = [];
  let sources: Array<{ name: string; excerpt?: string }> = [];

  for (const part of message.parts) {
    if (part.type === "text") {
      textChunks.push(part.text);
    } else if (part.type === "data-topic") {
      topic = part.data.name;
    } else if (part.type === "data-score") {
      score = part.data;
    } else if (part.type === "data-sources") {
      sources = part.data.items;
    }
  }

  const rawText = textChunks.join("").replace(/\[source:[^\]]*\]/gi, "").trim();

  // "Deferred: item, item" is a machine-readable line the model uses to note
  // which breakdown items it held back this turn (see CHUNK LIMIT in
  // prompts.ts) — parsed out here so it never leaks into what the student sees.
  const fullText = rawText.replace(/^Deferred:\s*.+$/im, "").replace(/\n{3,}/g, "\n\n").trim();

  // Split "Quick check: …" from the body so we can render it as a callout
  const quickCheckMatch = fullText.match(/Quick check:\s*([\s\S]+)$/i);
  const bodyText = quickCheckMatch
    ? fullText.slice(0, fullText.length - quickCheckMatch[0].length).trim()
    : fullText;
  const quickCheckQuestion = quickCheckMatch ? quickCheckMatch[1].trim() : null;

  const correctnessStyle = score ? CORRECTNESS_STYLES[score.correctness] : null;

  // During the file-search tool phase, the stream is active but no text has
  // arrived yet. Show the typing bubble instead of a blank card.
  if (!fullText && !topic && !score) {
    return (
      <Message from="assistant">
        <TypingBubble />
      </Message>
    );
  }

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
          <div className="mt-4 pt-3 border-t border-border space-y-2">
            <span className="inline-flex items-center rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold tracking-wide text-primary-foreground">
              Quick check
            </span>
            <p className="text-[15px] font-bold text-foreground leading-snug">
              {quickCheckQuestion}
            </p>
          </div>
        )}

        {sources.length > 0 && (
          <Sources>
            <SourcesTrigger count={sources.length}>
              <BookOpen className="size-3" />
              <span className="font-medium">
                {sources.length} source{sources.length > 1 ? "s" : ""}
              </span>
            </SourcesTrigger>
            <SourcesContent className="space-y-1.5">
              {sources.map((src, i) => (
                <div key={i} className="flex flex-col gap-1 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate text-foreground font-medium">{src.name}</span>
                  </div>
                  {src.excerpt && (
                    <p className="pl-5 text-muted-foreground leading-snug line-clamp-3">
                      {src.excerpt}
                    </p>
                  )}
                </div>
              ))}
            </SourcesContent>
          </Sources>
        )}
      </div>
    </Message>
  );
}
