import { eq, desc, asc, and, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { topics, interactions } from "@/db/schema";
import type { Topic } from "@/db/schema";
import { getMasteryTier } from "@/lib/mastery";
import type { ScoreHistoryEntry, Tier } from "@/types";

export async function getOrCreateTopic(
  userId: string,
  notebookId: string,
  name: string,
): Promise<Topic> {
  const existing = await db
    .select()
    .from(topics)
    .where(
      and(
        eq(topics.userId, userId),
        eq(topics.notebookId, notebookId),
        eq(topics.name, name),
      ),
    )
    .limit(1);

  if (existing[0]) return existing[0];

  const rows = await db
    .insert(topics)
    .values({ userId, notebookId, name })
    .onConflictDoNothing()
    .returning();

  if (rows.length === 0) {
    const fetched = await db
      .select()
      .from(topics)
      .where(
        and(
          eq(topics.userId, userId),
          eq(topics.notebookId, notebookId),
          eq(topics.name, name),
        ),
      )
      .limit(1);
    return fetched[0];
  }

  return rows[0];
}

export async function listNotebookTopicNames(
  userId: string,
  notebookId: string,
): Promise<string[]> {
  const rows = await db
    .select({ name: topics.name })
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.notebookId, notebookId)))
    .orderBy(desc(topics.updatedAt));
  return rows.map((r) => r.name);
}

// Lightweight notebook-scoped topic status for the student-facing topic map
// and starter chips — no recentHistory (unlike TopicWithHistory below, used
// by admin/dashboard views), and scoped to one notebook instead of a whole
// user. Ordering: topics the student has interacted with come first (most
// recent activity first), then never-touched topics in taxonomy/material
// order. That ordering relies on topics.updatedAt only ever being touched by
// updateMasteryScore after insert — for a never-interacted topic it stays
// frozen at insertion time, which approximates the material's own
// structural order (see EXTRACT_TOPICS_TEMPLATE). If any future code path
// "touches" a topic row without a real interaction, this ordering silently
// breaks.
export interface NotebookTopicStatus {
  id: string;
  name: string;
  masteryScore: number;
  tier: Tier;
  hasInteracted: boolean;
  updatedAt: Date;
}

export async function listNotebookTopicsWithStatus(
  userId: string,
  notebookId: string,
): Promise<NotebookTopicStatus[]> {
  const rows = await db
    .select({
      id: topics.id,
      name: topics.name,
      masteryScore: topics.masteryScore,
      updatedAt: topics.updatedAt,
      hasInteracted: sql<boolean>`EXISTS (
        SELECT 1 FROM ${interactions}
        WHERE ${interactions.topicId} = ${topics.id}
      )`,
    })
    .from(topics)
    .where(and(eq(topics.userId, userId), eq(topics.notebookId, notebookId)))
    .orderBy(asc(topics.updatedAt));

  const interacted = rows.filter((r) => r.hasInteracted).sort((a, b) => +b.updatedAt - +a.updatedAt);
  const notStarted = rows.filter((r) => !r.hasInteracted); // already asc by updatedAt = insertion order
  return [...interacted, ...notStarted].map((r) => ({ ...r, tier: getMasteryTier(r.masteryScore) }));
}

// Replaces the old ad hoc "ask Gemini to re-read the material's headings"
// advancement mechanism — this is a pure DB read against the taxonomy
// already extracted at upload time, so it's both faster (no Gemini call)
// and more reliable (can't fail to rediscover a topic the taxonomy already
// has). Returns null when every topic in the notebook has been interacted
// with — the caller treats that as "nothing left to advance to."
export async function findNextUninteractedTopic(
  userId: string,
  notebookId: string,
): Promise<Topic | null> {
  const rows = await db
    .select()
    .from(topics)
    .where(
      and(
        eq(topics.userId, userId),
        eq(topics.notebookId, notebookId),
        notExists(db.select({ n: sql`1` }).from(interactions).where(eq(interactions.topicId, topics.id))),
      ),
    )
    .orderBy(asc(topics.updatedAt))
    .limit(1);
  return rows[0] ?? null;
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
  notebookId: string;
  name: string;
  masteryScore: number;
  updatedAt: Date;
  tier: Tier;
  // False for a topic pre-seeded from the material's own structure at
  // upload time (see regenerateTopicTaxonomy in src/lib/ai/topic-taxonomy.ts)
  // that the student hasn't asked about yet — distinguishes "not yet
  // studied" from a genuine 0/100.
  hasInteracted: boolean;
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
      notebookId: topic.notebookId,
      name: topic.name,
      masteryScore: topic.masteryScore,
      updatedAt: topic.updatedAt,
      tier: getMasteryTier(topic.masteryScore),
      hasInteracted: history.length > 0,
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
