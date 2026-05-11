import type { UIMessage } from "ai";
import type { Citation, Correctness, Tier } from "@/types";

// Custom data parts emitted by the /api/chat route, attached to the assistant
// turn alongside the streamed guided-question text.
export type ChatDataParts = {
  topic: { name: string; mastery_score: number; tier: Tier };
  citations: { items: Citation[] };
  score: {
    correctness: Correctness | "give_up";
    score_delta: number;
    new_score: number;
    new_tier: Tier;
  };
  interaction: { id: string };
  suggestions: { items: string[] };
  // Marks whether the assistant message expects a guided answer or a free-form
  // follow-up. When mode === "answer" or "meta", the next user message should
  // be classified fresh, not treated as a reply.
  mode: { value: "guide" | "answer" | "meta" };
};

export type ChatMessage = UIMessage<never, ChatDataParts>;
