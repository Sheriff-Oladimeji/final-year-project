"use client";

import { useState, Fragment } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles, BookOpen, AlertCircle } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/ai/chat-types";
import type { Correctness } from "@/types";

interface ChatThreadProps {
  materialId: string;
  materialName: string;
  suggestions: string[];
}

const CORRECTNESS_STYLES: Record<Correctness, { label: string; className: string }> = {
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
};

export function ChatThread({ materialId, materialName, suggestions }: ChatThreadProps) {
  const [text, setText] = useState("");
  const [interactionId, setInteractionId] = useState<string | null>(null);

  const { messages, sendMessage, status, error } = useChat<ChatMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onData: ({ type, data }) => {
      if (type === "data-interaction") {
        setInteractionId((data as { id: string }).id);
      }
    },
  });

  function send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed) return;
    sendMessage(
      { text: trimmed },
      { body: { materialId, interactionId: interactionId ?? undefined } },
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

  const showSuggestions = messages.length === 0 && suggestions.length > 0;

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="px-0">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<Sparkles className="size-10 text-primary" />}
              title={`Ask anything about ${materialName}`}
              description="Your guide responds with questions calibrated to your mastery level (recall, application, analysis) instead of direct answers."
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

      {showSuggestions && (
        <div className="mb-3">
          <Suggestions>
            {suggestions.map((s) => (
              <Suggestion key={s} suggestion={s} onClick={(v) => send(v)} />
            ))}
          </Suggestions>
        </div>
      )}

      <PromptInput onSubmit={handleSubmit} className="border-t-0">
        <PromptInputBody>
          <PromptInputTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              interactionId
                ? "Type your answer to the guided question…"
                : `Ask anything about ${materialName}…`
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
  );
}

function AssistantTurn({ message }: { message: ChatMessage }) {
  let topic: string | null = null;
  let citations: { source: string; excerpt: string }[] = [];
  let score: { correctness: Correctness; score_delta: number; new_score: number } | null = null;
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
