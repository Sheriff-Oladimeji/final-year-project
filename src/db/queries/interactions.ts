import { eq, and, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { interactions } from "@/db/schema";
import type { Interaction } from "@/db/schema";

export async function createInteraction(data: {
  userId: string;
  sessionId?: string;
  topicId: string;
  question: string;
  retrievedContext: string;
  promptTemplate: string;
  response: string;
}): Promise<Interaction> {
  const rows = await db.insert(interactions).values(data).returning();
  return rows[0];
}

export async function updateInteraction(
  id: string,
  userId: string,
  data: { studentReply: string; correctness: string; scoreDelta: number },
): Promise<Interaction> {
  const rows = await db
    .update(interactions)
    .set(data)
    .where(and(eq(interactions.id, id), eq(interactions.userId, userId)))
    .returning();
  return rows[0];
}

export async function getInteraction(id: string, userId: string): Promise<Interaction | null> {
  const rows = await db
    .select()
    .from(interactions)
    .where(and(eq(interactions.id, id), eq(interactions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listInteractionsByTopic(
  topicId: string,
  userId: string,
  limit = 50,
): Promise<Interaction[]> {
  return db
    .select()
    .from(interactions)
    .where(and(eq(interactions.topicId, topicId), eq(interactions.userId, userId)))
    .orderBy(desc(interactions.createdAt))
    .limit(limit);
}

export async function listInteractionsAdmin(params: {
  userId?: string;
  topicId?: string;
  fromDate?: Date;
  toDate?: Date;
  skip?: number;
  limit?: number;
}): Promise<Interaction[]> {
  const conditions = [];
  if (params.userId)   conditions.push(eq(interactions.userId, params.userId));
  if (params.topicId)  conditions.push(eq(interactions.topicId, params.topicId));
  if (params.fromDate) conditions.push(gte(interactions.createdAt, params.fromDate));
  if (params.toDate)   conditions.push(lte(interactions.createdAt, params.toDate));

  const query = db
    .select()
    .from(interactions)
    .orderBy(desc(interactions.createdAt))
    .limit(params.limit ?? 100)
    .offset(params.skip ?? 0);

  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}
