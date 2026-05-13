import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { notebooks } from "@/db/schema";
import type { Notebook } from "@/db/schema";

export async function createNotebook(data: {
  userId: string;
  title: string;
}): Promise<Notebook> {
  const rows = await db
    .insert(notebooks)
    .values({ userId: data.userId, title: data.title })
    .returning();
  return rows[0];
}

export async function listNotebooks(userId: string): Promise<Notebook[]> {
  return db
    .select()
    .from(notebooks)
    .where(eq(notebooks.userId, userId))
    .orderBy(desc(notebooks.updatedAt));
}

export async function getNotebook(id: string, userId: string): Promise<Notebook | null> {
  const rows = await db
    .select()
    .from(notebooks)
    .where(eq(notebooks.id, id))
    .limit(1);
  const n = rows[0];
  if (!n || n.userId !== userId) return null;
  return n;
}

export async function renameNotebook(
  id: string,
  userId: string,
  title: string,
): Promise<Notebook | null> {
  const rows = await db
    .update(notebooks)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
    .returning();
  return rows[0] ?? null;
}

export async function touchNotebook(id: string, userId: string): Promise<void> {
  await db
    .update(notebooks)
    .set({ updatedAt: new Date() })
    .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)));
}

export async function deleteNotebook(id: string, userId: string): Promise<void> {
  await db
    .delete(notebooks)
    .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)));
}
