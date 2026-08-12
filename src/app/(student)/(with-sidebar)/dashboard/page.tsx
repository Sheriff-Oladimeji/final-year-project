export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Library } from "lucide-react";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { materials, topics, interactions } from "@/db/schema";
import { listNotebooks } from "@/db/queries/notebooks";
import { NotebookGrid } from "@/components/notebooks/NotebookGrid";
import { NewNotebookDialog } from "@/components/notebooks/NewNotebookDialog";
import type { Notebook } from "@/types";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const rawNotebooks = await listNotebooks(session.user.id);
  const notebooks: Notebook[] = rawNotebooks.map((n) => ({
    id: n.id,
    user_id: n.userId,
    title: n.title,
    summary: n.summary,
    starter_suggestions: n.starterSuggestions ?? [],
    created_at: n.createdAt.toISOString(),
    updated_at: n.updatedAt.toISOString(),
  }));

  // Tally stats per notebook in batched queries.
  const [materialCounts, topicRows, interactedTopicIds] = await Promise.all([
    db
      .select({ notebookId: materials.notebookId, id: materials.id })
      .from(materials)
      .where(eq(materials.userId, session.user.id)),
    db
      .select({
        id: topics.id,
        notebookId: topics.notebookId,
        masteryScore: topics.masteryScore,
      })
      .from(topics)
      .where(eq(topics.userId, session.user.id)),
    db
      .selectDistinct({ topicId: interactions.topicId })
      .from(interactions)
      .where(eq(interactions.userId, session.user.id)),
  ]);

  const sourceCountByNotebook = new Map<string, number>();
  for (const m of materialCounts) {
    sourceCountByNotebook.set(m.notebookId, (sourceCountByNotebook.get(m.notebookId) ?? 0) + 1);
  }
  // Topics are now pre-seeded from the material's own structure at upload
  // time (see regenerateNotebookSummary in src/actions/materials.ts), so a
  // brand-new notebook can have several topic rows before the student has
  // asked anything. Counting/averaging those would misleadingly read as
  // "assessed on N topics, scored zero" — only topics with a real
  // interaction count toward the dashboard stats.
  const interactedSet = new Set(interactedTopicIds.map((r) => r.topicId));
  const topicStatsByNotebook = new Map<string, { count: number; total: number }>();
  for (const t of topicRows) {
    if (!interactedSet.has(t.id)) continue;
    const cur = topicStatsByNotebook.get(t.notebookId) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += t.masteryScore;
    topicStatsByNotebook.set(t.notebookId, cur);
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notebooks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Group up to 10 sources per notebook. Chat across them and track per-topic mastery.
          </p>
        </div>
        <NewNotebookDialog />
      </div>

      {notebooks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Library className="size-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">No notebooks yet</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Create your first notebook to start grouping sources and chatting with them.
              </p>
            </div>
            <NewNotebookDialog />
          </div>
        </div>
      ) : (
        <NotebookGrid
          entries={notebooks.map((nb) => {
            const sourceCount = sourceCountByNotebook.get(nb.id) ?? 0;
            const stats = topicStatsByNotebook.get(nb.id);
            const avg = stats && stats.count > 0 ? Math.round(stats.total / stats.count) : null;
            return { notebook: nb, sourceCount, topicCount: stats?.count ?? 0, averageMastery: avg };
          })}
        />
      )}
    </div>
  );
}
