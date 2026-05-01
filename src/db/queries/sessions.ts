import { eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import type { Session } from "@/db/schema";

export async function createSession(userId: string): Promise<Session> {
  const rows = await db.insert(sessions).values({ userId }).returning();
  return rows[0];
}

export async function endSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ endedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function findActiveSession(userId: string): Promise<Session | null> {
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    // Active sessions have endedAt = NULL
    // Using isNull filter
    .orderBy(sessions.startedAt)
    .limit(1);
  // Filter for active sessions (endedAt is null)
  const active = rows.find((s) => s.endedAt === null);
  return active ?? null;
}
