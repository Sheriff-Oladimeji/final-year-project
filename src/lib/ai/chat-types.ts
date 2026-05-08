import type { UIMessage } from "ai";
import type { Citation, Correctness } from "@/types";

// Custom data parts emitted by the /api/chat route, attached to the assistant
// turn alongside the streamed guided-question text.
export type ChatDataParts = {
  topic: { name: string };
  citations: { items: Citation[] };
  score: {
    correctness: Correctness;
    score_delta: number;
    new_score: number;
  };
  interaction: { id: string };
};

export type ChatMessage = UIMessage<never, ChatDataParts>;
