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
import { Skeleton } from "@/components/ui/skeleton";
import { SessionInfoSidebar } from "./SessionInfoSidebar";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/ai/chat-types";
import type { Notebook, Material, Correctness, Tier, NotebookTopicStatus } from "@/types";

interface ChatThreadProps {
  notebook: Notebook;
  materials: Material[];
  notebookTopics: NotebookTopicStatus[];
  topicsExtracting: boolean;
  initialMessages: ChatMessage[];
  initialInteractionId: string | null;
  mobileMasteryOpen?: boolean;
  onMobileMasteryClose?: () => void;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  notebookTopics,
  topicsExtracting,
  initialMessages,
  initialInteractionId,
  mobileMasteryOpen = false,
  onMobileMasteryClose,
}: ChatThreadProps) {
  const [text, setText] = useState("");
  const [interactionId, setInteractionId] = useState<string | null>(initialInteractionId);

  const readyCount = materials.filter((m) => m.status === "ready").length;
  const noReadySources = readyCount === 0;
  // A source can be "ready" while the notebook's own summary/taxonomy are
  // still being prepared in the background — asking a question in that
  // window is premature, so the input stays disabled until both land, not
  // just until the first source finishes indexing.
  const stillSettingUp = !noReadySources && (notebook.summary === null || topicsExtracting);
  const inputDisabled = noReadySources || stillSettingUp;

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

  // Tracks EVERY topic touched this session, not just the most recent one —
  // a Map keyed by topic name, insertion-ordered oldest-first, so a topic
  // that was advanced past earlier in the conversation keeps its live
  // score/tier instead of reverting to the page-load snapshot (which
  // predates this session's interactions and would show it as untouched).
  const { currentTopicName, liveTopics, recentCorrectness } = useMemo(() => {
    let currentTopicName: string | null = null;
    const liveTopics = new Map<string, { mastery_score: number; tier: Tier; completed: boolean }>();
    const recent: (Correctness | "give_up")[] = [];

    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts) {
        if (part.type === "data-topic") {
          currentTopicName = part.data.name;
          // A fresh "topic" event means this topic is active again (first
          // time, or revisited) — not completed until it's scored correct.
          liveTopics.set(part.data.name, { mastery_score: part.data.mastery_score, tier: part.data.tier, completed: false });
        } else if (part.type === "data-score") {
          // Scoped by the event's own topic_name, NOT currentTopicName — on
          // an advance turn, "topic" (above) already announced the NEXT
          // topic while this score still reports the PREVIOUS one's result;
          // keying off currentTopicName here would overwrite the new
          // topic's fresh 0 score with the old topic's final score, and
          // leave the old topic's row stuck at whatever it was before it
          // was mastered.
          if (part.data.topic_name) {
            liveTopics.set(part.data.topic_name, {
              mastery_score: part.data.new_score,
              tier: part.data.new_tier,
              completed: part.data.correctness === "correct",
            });
          }
          recent.push(part.data.correctness);
        }
      }
    }
    const recentCorrectness = recent.filter((c): c is Correctness => c !== "give_up");
    return { currentTopicName, liveTopics, recentCorrectness };
  }, [messages]);

  // Merges the server-fetched notebook topic list with every topic that's
  // gone live in this conversation (from the useMemo above, updated in real
  // time via streamed data-topic/data-score parts) — so each topic's row
  // reflects its freshest score/tier without a full page refetch, and a
  // topic classified ad hoc mid-session (not in the server snapshot) still
  // shows up rather than being silently dropped. Topics touched this
  // session are ordered most-recently-touched-first (current topic pinned
  // to the very front), ahead of topics only known from the initial
  // snapshot — that matches what the student actually wants to see first.
  const sidebarTopics = useMemo((): NotebookTopicStatus[] => {
    if (liveTopics.size === 0) return notebookTopics;
    const byName = new Map(notebookTopics.map((t) => [t.name, t]));
    const liveNamesNewestFirst = [...liveTopics.keys()].reverse();
    const liveRows: NotebookTopicStatus[] = liveNamesNewestFirst.map((name) => {
      const live = liveTopics.get(name)!;
      const existing = byName.get(name);
      return {
        id: existing?.id ?? `live-${name}`,
        name,
        // A topic that was correctly finished and left behind shows as
        // fully done. The raw internal mastery_score (e.g. 15 after a
        // single correct answer) is designed to accrue gradually across
        // many questions, but advancement now happens after just one
        // correct answer — so the raw number would read as "barely
        // started" right after the tutor said "you've got a solid handle
        // on this." Only the student-facing bar is affected; the real
        // score in the DB (used for admin/thesis analytics) is untouched.
        mastery_score: live.completed ? 100 : live.mastery_score,
        tier: live.completed ? "analysis" : live.tier,
        has_interacted: true,
      };
    });
    const rest = notebookTopics.filter((t) => !liveTopics.has(t.name));
    return [...liveRows, ...rest];
  }, [notebookTopics, liveTopics]);

  const startTopics = notebookTopics.filter((t) => !t.has_interacted).slice(0, 3);

  function send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed || inputDisabled) return;
    sendMessage(
      { text: trimmed },
      { body: { notebookId: notebook.id, interactionId: interactionId ?? undefined } },
    );
    setText("");
  }

  function handleSubmit(message: PromptInputMessage) {
    if (message.text) send(message.text);
  }

  // Fills the input with a topic-scoped prompt but does NOT send it — the
  // student reviews/edits it before hitting send themselves. A topic
  // that's already been interacted with gets a review-style prompt rather
  // than "Teach me X" again, since it's not being introduced for the
  // first time.
  function setTopicPrompt(topic: NotebookTopicStatus) {
    const label = capitalize(topic.name);
    setText(topic.has_interacted ? `Quiz me on ${label} again` : `Teach me ${label}`);
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
            >
              {noReadySources ? undefined : notebook.summary ? (
                <div className="w-full max-w-xl space-y-4 text-left">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Sparkles className="size-3.5" />
                    <span className="text-xs font-medium tracking-wide uppercase">
                      Here&apos;s what we&apos;ll cover
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">
                    {notebook.summary}
                  </p>
                  {startTopics.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Start with:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {startTopics.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => send(`Teach me ${capitalize(t.name)}`)}
                            className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                          >
                            Teach me {capitalize(t.name)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : topicsExtracting ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Skeleton className="h-7 w-40 rounded-full" />
                      <Skeleton className="h-7 w-48 rounded-full" />
                      <Skeleton className="h-7 w-36 rounded-full" />
                    </div>
                  ) : null}
                </div>
              ) : (
                // Materials are ready but the background summary generation
                // (regenerateNotebookSummary) hasn't landed yet — SourcesPanel
                // keeps polling until notebook.summary is set, which swaps
                // this skeleton for the real content automatically.
                <div className="w-full max-w-xl space-y-4 text-left mt-6" aria-label="Generating notebook summary">
                  <div className="flex items-center gap-1.5 text-primary">
                    <Sparkles className="size-3.5 animate-pulse" />
                    <span className="text-xs font-medium tracking-wide uppercase">
                      Generating summary…
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Skeleton className="h-7 w-40 rounded-full" />
                    <Skeleton className="h-7 w-48 rounded-full" />
                    <Skeleton className="h-7 w-36 rounded-full" />
                  </div>
                </div>
              )}
            </ConversationEmptyState>
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

      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={inputDisabled}
            placeholder={
              noReadySources
                ? "Add a source first to start chatting…"
                : stillSettingUp
                  ? "Getting your notebook ready…"
                  : interactionId
                    ? "Answer the Quick check, or ask something else…"
                    : `Ask anything about ${notebook.title}…`
            }
          />
        </PromptInputBody>
        <PromptInputFooter>
          <span className="text-xs text-muted-foreground">
            {stillSettingUp ? "Just a moment…" : "Enter to send · Shift+Enter for new line"}
          </span>
          <PromptInputSubmit
            status={submitStatus}
            disabled={!text.trim() || inputDisabled}
          />
        </PromptInputFooter>
      </PromptInput>
      </div>

      <SessionInfoSidebar
        notebookTitle={notebook.title}
        sourceCount={materials.length}
        topics={sidebarTopics}
        topicsExtracting={topicsExtracting}
        currentTopicName={currentTopicName}
        recentCorrectness={recentCorrectness}
        onTopicAction={inputDisabled ? undefined : setTopicPrompt}
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
              <Badge variant="outline" className={cn("text-xs", correctnessStyle.className)}>
                {correctnessStyle.label}
              </Badge>
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
