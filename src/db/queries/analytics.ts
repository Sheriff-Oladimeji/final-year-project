import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { interactions, user } from "@/db/schema";

// 30 minutes of inactivity ends a "study session." This is the standard
// gap threshold used in learning-analytics literature for splitting a
// continuous log into discrete sessions — see the research notes in
// section 3.7 of the thesis. Deliberately NOT using interactions.sessionId
// for this: that column holds the Better Auth login session id, which can
// span days, not a single sitting.
const SESSION_GAP_MS = 30 * 60 * 1000;

function splitIntoSessions(timestampsAsc: Date[]): { count: number; avgLengthMs: number } {
  if (timestampsAsc.length === 0) return { count: 0, avgLengthMs: 0 };

  const sessions: Date[][] = [[timestampsAsc[0]]];
  for (let i = 1; i < timestampsAsc.length; i++) {
    const gap = timestampsAsc[i].getTime() - timestampsAsc[i - 1].getTime();
    if (gap > SESSION_GAP_MS) {
      sessions.push([timestampsAsc[i]]);
    } else {
      sessions[sessions.length - 1].push(timestampsAsc[i]);
    }
  }

  const lengths = sessions.map((s) => s[s.length - 1].getTime() - s[0].getTime());
  const avgLengthMs = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return { count: sessions.length, avgLengthMs };
}

export interface StudentAnalytics {
  userId: string;
  email: string;
  totalInteractions: number;
  correctnessCounts: Record<string, number>;
  topicsTouched: number;
  sessionCount: number;
  avgSessionLengthMinutes: number;
  avgLatencyMs: number | null;
}

export async function getStudentAnalytics(): Promise<StudentAnalytics[]> {
  const rows = await db
    .select({
      userId: interactions.userId,
      email: user.email,
      createdAt: interactions.createdAt,
      correctness: interactions.correctness,
      topicId: interactions.topicId,
      latencyMs: interactions.latencyMs,
    })
    .from(interactions)
    .innerJoin(user, eq(interactions.userId, user.id))
    .orderBy(asc(interactions.createdAt));

  const byUser = new Map<string, { email: string; rows: typeof rows }>();
  for (const row of rows) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, { email: row.email, rows: [] });
    byUser.get(row.userId)!.rows.push(row);
  }

  const result: StudentAnalytics[] = [];
  for (const [userId, { email, rows: userRows }] of byUser) {
    const correctnessCounts: Record<string, number> = {};
    const topicIds = new Set<string>();
    let latencySum = 0;
    let latencyCount = 0;

    for (const r of userRows) {
      correctnessCounts[r.correctness] = (correctnessCounts[r.correctness] ?? 0) + 1;
      topicIds.add(r.topicId);
      if (r.latencyMs != null) {
        latencySum += r.latencyMs;
        latencyCount += 1;
      }
    }

    const { count: sessionCount, avgLengthMs } = splitIntoSessions(userRows.map((r) => r.createdAt));

    result.push({
      userId,
      email,
      totalInteractions: userRows.length,
      correctnessCounts,
      topicsTouched: topicIds.size,
      sessionCount,
      avgSessionLengthMinutes: Math.round(avgLengthMs / 60_000),
      avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
    });
  }

  return result.sort((a, b) => b.totalInteractions - a.totalInteractions);
}
