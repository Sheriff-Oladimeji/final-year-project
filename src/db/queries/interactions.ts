import { eq, and, desc, asc, gte, lte, count } from "drizzle-orm";
import { db } from "@/db";
import { interactions, user, topics } from "@/db/schema";
import type { Interaction } from "@/db/schema";

export type InteractionWithEmail = Interaction & { userEmail: string; topicName: string };

export async function createInteraction(data: {
  userId: string;
  sessionId?: string;
  notebookId: string;
  topicId: string;
  question: string;
  retrievedContext: string;
  promptTemplate: string;
  response: string;
  latencyMs?: number;
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

export async function listInteractionsByNotebook(
  userId: string,
  notebookId: string,
  limit = 200,
): Promise<Interaction[]> {
  return db
    .select()
    .from(interactions)
    .where(and(eq(interactions.userId, userId), eq(interactions.notebookId, notebookId)))
    .orderBy(asc(interactions.createdAt))
    .limit(limit);
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
}): Promise<InteractionWithEmail[]> {
  const conditions = [];
  if (params.userId)   conditions.push(eq(interactions.userId, params.userId));
  if (params.topicId)  conditions.push(eq(interactions.topicId, params.topicId));
  if (params.fromDate) conditions.push(gte(interactions.createdAt, params.fromDate));
  if (params.toDate)   conditions.push(lte(interactions.createdAt, params.toDate));

  const rows = await db
    .select({ interaction: interactions, userEmail: user.email, topicName: topics.name })
    .from(interactions)
    .innerJoin(user, eq(interactions.userId, user.id))
    .innerJoin(topics, eq(interactions.topicId, topics.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(interactions.createdAt))
    .limit(params.limit ?? 200)
    .offset(params.skip ?? 0);

  return rows.map(({ interaction, userEmail, topicName }) => ({ ...interaction, userEmail, topicName }));
}

export async function countAllInteractions(): Promise<number> {
  const rows = await db.select({ n: count() }).from(interactions);
  return rows[0]?.n ?? 0;
}
