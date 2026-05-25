import type { UIMessage } from "ai";
import type { Correctness, Tier } from "@/types";

// Custom data parts emitted by the /api/chat route, attached to the assistant
// turn alongside the streamed answer text.
export type ChatDataParts = {
  topic: { name: string; mastery_score: number; tier: Tier };
  // Names of the notebook materials that were searched to ground this answer.
  sources: { items: string[] };
  score: {
    correctness: Correctness | "give_up";
    score_delta: number;
    new_score: number;
    new_tier: Tier;
  };
  interaction: { id: string };
  // Marks whether the assistant message expects a guided answer or a free-form
  // follow-up. When mode === "answer" or "meta", the next user message should
  // be classified fresh, not treated as a reply.
  mode: { value: "guide" | "answer" | "meta" };
};

export type ChatMessage = UIMessage<never, ChatDataParts>;
