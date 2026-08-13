import type { Interaction } from "@/db/schema";
import type { ChatMessage } from "./chat-types";
import type { Correctness, Tier } from "@/types";
import { clipScore, getMasteryTier } from "@/lib/mastery";

export interface TopicSnapshot {
  id: string;
  name: string;
}

export interface HistoryReplay {
  messages: ChatMessage[];
  lastUnscoredId: string | null;
}

// Reconstructs the chat as the user saw it from the persisted interaction
// rows. Handles thread continuity (chain of turns sharing the same `question`)
// and computes running mastery per topic so the sidebar shows accurate
// historical numbers.
export function interactionsToUIMessages(
  rows: Interaction[],
  topics: Map<string, TopicSnapshot>,
): HistoryReplay {
  const messages: ChatMessage[] = [];
  const runningScore = new Map<string, number>();
  let prev: Interaction | null = null;
  let lastUnscoredId: string | null = null;

  for (const it of rows) {
    const topic = topics.get(it.topicId);
    const isNewChain = !prev || it.question !== prev.question;

    // ── User turn ─────────────────────────────────────────────────────
    const userText = isNewChain ? it.question : (prev?.studentReply ?? "");
    if (userText) {
      messages.push({
        id: `u-${it.id}`,
        role: "user",
        parts: [{ type: "text", text: userText }],
      });
    }

    // ── Assistant turn ────────────────────────────────────────────────
    const assistantParts: ChatMessage["parts"] = [];

    // Score badge if the prior reply was scored AND this row is a genuine
    // continuation of it — either same-topic reinforcement (topicId
    // unchanged) or an advance to the next topic right after mastering the
    // previous one (promptTemplate === "advance", topicId differs). Plain
    // `!isNewChain` used to gate this, but isNewChain is also true on an
    // advance turn (the question text changes), which wrongly hid the
    // score badge on exactly the turn that matters most — right after the
    // student masters a topic and moves on. Excluding a genuinely
    // unrelated new topic (fresh new_question classification) still works:
    // that row's topicId differs AND its promptTemplate isn't "advance".
    const isScoredContinuation = it.topicId === prev?.topicId || it.promptTemplate === "advance";
    if (prev && prev.correctness !== "unscored" && isScoredContinuation) {
      const prevTopic = topics.get(prev.topicId);
      const before = runningScore.get(prev.topicId) ?? 0;
      const after = clipScore(before + prev.scoreDelta);
      runningScore.set(prev.topicId, after);

      assistantParts.push({
        type: "data-score",
        id: `score-${it.id}`,
        data: {
          topic_name: prevTopic?.name ?? "",
          correctness: prev.correctness as Correctness | "give_up",
          score_delta: prev.scoreDelta,
          new_score: after,
          new_tier: getMasteryTier(after),
        },
      });
    }

    if (topic) {
      const currentScore = runningScore.get(topic.id) ?? 0;
      assistantParts.push({
        type: "data-topic",
        id: `topic-${it.id}`,
        data: {
          name: topic.name,
          mastery_score: currentScore,
          tier: getMasteryTier(currentScore) as Tier,
        },
      });
    }

    assistantParts.push({ type: "text", text: it.response });

    // Restore sources that were persisted as JSON in retrievedContext.
    if (it.retrievedContext) {
      try {
        const items = JSON.parse(it.retrievedContext) as Array<{ name: string; excerpt?: string }>;
        if (Array.isArray(items) && items.length > 0) {
          assistantParts.push({
            type: "data-sources",
            id: `sources-${it.id}`,
            data: { items },
          });
        }
      } catch {
        // Legacy rows with plain text or empty string — skip.
      }
    }

    messages.push({
      id: `a-${it.id}`,
      role: "assistant",
      parts: assistantParts,
    });

    prev = it;
  }

  // The most recent unscored interaction is the one waiting for a reply.
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].correctness === "unscored") {
      lastUnscoredId = rows[i].id;
      break;
    }
  }

  return { messages, lastUnscoredId };
}
