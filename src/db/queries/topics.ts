import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { topics, interactions } from "@/db/schema";
import type { Topic } from "@/db/schema";
import { getMasteryTier } from "@/lib/mastery";
import type { ScoreHistoryEntry, Tier } from "@/types";

export async function getOrCreateTopic(
  userId: string,
  materialId: string,
  name: string,
): Promise<Topic> {
  // Topics are scoped per (user, material, name).
  const existing = await db
    .select()
    .from(topics)
    .where(
      and(
        eq(topics.userId, userId),
        eq(topics.materialId, materialId),
        eq(topics.name, name),
      ),
    )
    .limit(1);

  if (existing[0]) return existing[0];

  const rows = await db
    .insert(topics)
    .values({ userId, materialId, name })
    .onConflictDoNothing()
    .returning();

  if (rows.length === 0) {
    // Concurrent insert won the race — re-fetch.
    const fetched = await db
      .select()
      .from(topics)
      .where(
        and(
          eq(topics.userId, userId),
          eq(topics.materialId, materialId),
          eq(topics.name, name),
        ),
      )
      .limit(1);
    return fetched[0];
  }

  return rows[0];
}

export async function listMaterialTopicNames(
  userId: string,
  materialId: string,
): Promise<string[]> {
  const rows = await db
    .select({ name: topics.name })
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.materialId, materialId)))
    .orderBy(desc(topics.updatedAt));
  return rows.map((r) => r.name);
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
  materialId: string;
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
      .where(eq(interactions.topicId, topic.id))
      .orderBy(desc(interactions.createdAt))
      .limit(historyLimit);

    result.push({
      id: topic.id,
      materialId: topic.materialId,
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
