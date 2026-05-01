import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { topics, interactions } from "@/db/schema";
import type { Topic } from "@/db/schema";
import { getMasteryTier } from "@/lib/mastery";
import type { ScoreHistoryEntry, Tier } from "@/types";

export async function getOrCreateTopic(userId: string, name: string): Promise<Topic> {
  // Try to find existing topic first
  const existing = await db
    .select()
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.name, name)))
    .limit(1);

  if (existing[0]) return existing[0];

  // Insert, ignoring conflict on (userId, name) in case of a race condition
  const rows = await db
    .insert(topics)
    .values({ userId, name })
    .onConflictDoNothing()
    .returning();

  // If rows is empty, the concurrent insert won — re-fetch
  if (rows.length === 0) {
    const fetched = await db
      .select()
      .from(topics)
      .where(and(eq(topics.userId, userId), eq(topics.name, name)))
      .limit(1);
    return fetched[0];
  }

  return rows[0];
}

export async function updateMasteryScore(topicId: string, newScore: number): Promise<Topic> {
  const rows = await db
    .update(topics)
    .set({ masteryScore: newScore, updatedAt: new Date() })
    .where(eq(topics.id, topicId))
    .returning();
  return rows[0];
}

export interface TopicWithHistory {
  id: string;
  name: string;
  masteryScore: number;
  updatedAt: Date;
  tier: Tier;
  recentHistory: ScoreHistoryEntry[];
}

export async function listTopicsWithHistory(
  userId: string,
  historyLimit = 10,
): Promise<TopicWithHistory[]> {
  const userTopics = await db
    .select()
    .from(topics)
    .where(eq(topics.userId, userId))
    .orderBy(desc(topics.masteryScore));

  const result: TopicWithHistory[] = [];

  for (const topic of userTopics) {
    const history = await db
      .select({
        createdAt: interactions.createdAt,
        scoreDelta: interactions.scoreDelta,
        correctness: interactions.correctness,
      })
      .from(interactions)
      .where(
        and(
          eq(interactions.topicId, topic.id),
          // Only scored interactions have meaningful deltas
        ),
      )
      .orderBy(desc(interactions.createdAt))
      .limit(historyLimit);

    result.push({
      id: topic.id,
      name: topic.name,
      masteryScore: topic.masteryScore,
      updatedAt: topic.updatedAt,
      tier: getMasteryTier(topic.masteryScore),
      recentHistory: history
        .filter((h) => h.correctness !== "unscored")
        .map((h) => ({
          created_at: h.createdAt.toISOString(),
          score_delta: h.scoreDelta,
          correctness: h.correctness as ScoreHistoryEntry["correctness"],
        })),
    });
  }

  return result;
}
