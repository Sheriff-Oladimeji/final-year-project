import { eq, and, or, desc, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { notebooks } from "@/db/schema";
import type { Notebook } from "@/db/schema";

export async function createNotebook(data: {
  userId: string;
  title: string;
  fileSearchStoreName?: string;
}): Promise<Notebook> {
  const rows = await db
    .insert(notebooks)
    .values({ userId: data.userId, title: data.title, fileSearchStoreName: data.fileSearchStoreName })
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

// Atomic claim so a batch of concurrent background tasks (multi-file upload)
// doesn't all fire the same expensive summary generation at once — only the
// caller that flips summary_generating from false to true wins, everyone
// else gets false back and skips.
export async function claimNotebookSummarySlot(id: string, userId: string): Promise<boolean> {
  const rows = await db
    .update(notebooks)
    .set({ summaryGenerating: true })
    .where(
      and(
        eq(notebooks.id, id),
        eq(notebooks.userId, userId),
        isNull(notebooks.summary),
        eq(notebooks.summaryGenerating, false),
      ),
    )
    .returning({ id: notebooks.id });
  return rows.length > 0;
}

export async function setNotebookSummary(
  id: string,
  userId: string,
  summary: string,
): Promise<Notebook | null> {
  const rows = await db
    .update(notebooks)
    .set({ summary, updatedAt: new Date() })
    .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)))
    .returning();
  return rows[0] ?? null;
}

// How long a claim is honored before it's treated as abandoned (crashed
// process, deploy restart, execution-time limit hit mid-drain-loop) and a
// later caller is allowed to reclaim it. Generous relative to how long a
// real drain loop takes, so it never fires against a genuinely in-progress
// run — it exists purely to recover from the mutex holder never reaching
// its own finally block.
const STALE_CLAIM_MS = 10 * 60 * 1000;

// Repeatable claim — unlike claimNotebookSummarySlot above, this has no
// "already done" condition, so it can be won again on every new material
// upload. Also self-heals: a claim older than STALE_CLAIM_MS is treated as
// abandoned and can be reclaimed, since nothing else ever resets
// topicsExtracting back to false if the holder crashes before its finally
// block runs. See regenerateTopicTaxonomy in src/lib/ai/topic-taxonomy.ts.
export async function claimTopicsExtractionSlot(id: string, userId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
  const rows = await db
    .update(notebooks)
    .set({ topicsExtracting: true, topicsExtractionClaimedAt: new Date() })
    .where(
      and(
        eq(notebooks.id, id),
        eq(notebooks.userId, userId),
        or(
          eq(notebooks.topicsExtracting, false),
          lt(notebooks.topicsExtractionClaimedAt, staleBefore),
        ),
      ),
    )
    .returning({ id: notebooks.id });
  return rows.length > 0;
}

// Always releases the mutex (and clears the claim timestamp). Only stamps
// topicsExtractedAt when extractedAt is non-null (a genuine successful
// pass) — a failed/aborted run leaves the stamp untouched so the next
// upload's skip-check still triggers a retry instead of falsely treating
// that content as already covered.
export async function releaseTopicsExtractionSlot(
  id: string,
  userId: string,
  extractedAt: Date | null,
): Promise<void> {
  await db
    .update(notebooks)
    .set(
      extractedAt
        ? { topicsExtracting: false, topicsExtractionClaimedAt: null, topicsExtractedAt: extractedAt }
        : { topicsExtracting: false, topicsExtractionClaimedAt: null },
    )
    .where(and(eq(notebooks.id, id), eq(notebooks.userId, userId)));
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
