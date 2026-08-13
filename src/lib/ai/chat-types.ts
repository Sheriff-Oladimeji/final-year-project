import type { UIMessage } from "ai";
import type { Correctness, Tier } from "@/types";

// Custom data parts emitted by the /api/chat route, attached to the assistant
// turn alongside the streamed answer text.
export type ChatDataParts = {
  topic: { name: string; mastery_score: number; tier: Tier };
  // Sources used to ground this answer, with optional retrieved passage excerpt.
  sources: { items: Array<{ name: string; excerpt?: string }> };
  score: {
    // The topic this score update applies to — NOT necessarily the topic
    // named in a same-turn "topic" data part. On an advance turn, "topic"
    // announces the NEXT topic the student is moving to while "score" still
    // reports the result for the topic they just finished; without its own
    // name here a client has to guess the association from part order,
    // which breaks on exactly that turn.
    topic_name: string;
    correctness: Correctness | "give_up";
    score_delta: number;
    new_score: number;
    new_tier: Tier;
  };
  interaction: { id: string };
  // Suggested next messages the student might send — context-aware follow-ups
  // generated from the topic, tier, mastery, and whether a check is pending.
  suggestions: { items: string[] };
  // Marks whether the assistant message expects a guided answer or a free-form
  // follow-up. When mode === "answer" or "meta", the next user message should
  // be classified fresh, not treated as a reply.
  mode: { value: "guide" | "answer" | "meta" };
};

export type ChatMessage = UIMessage<never, ChatDataParts>;
