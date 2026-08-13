export const dynamic = "force-dynamic";
// Needed so after() callbacks (Gemini file upload) survive on Vercel.
// Requires Fluid Compute to be enabled in the Vercel dashboard (free on all plans).
export const maxDuration = 300;

import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getNotebook } from "@/db/queries/notebooks";
import { listMaterialsByNotebook } from "@/db/queries/materials";
import { listInteractionsByNotebook } from "@/db/queries/interactions";
import { listNotebookTopicsWithStatus } from "@/db/queries/topics";
import { interactionsToUIMessages, type TopicSnapshot } from "@/lib/ai/history";
import { NotebookDetail } from "@/components/notebooks/NotebookDetail";
import type { Notebook, Material, NotebookTopicStatus } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function NotebookPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const { id } = await params;
  const rawNotebook = await getNotebook(id, session.user.id);
  if (!rawNotebook) notFound();

  const notebook: Notebook = {
    id: rawNotebook.id,
    user_id: rawNotebook.userId,
    title: rawNotebook.title,
    summary: rawNotebook.summary,
    created_at: rawNotebook.createdAt.toISOString(),
    updated_at: rawNotebook.updatedAt.toISOString(),
  };

  const [rawMaterials, interactions, notebookTopicsRaw] = await Promise.all([
    listMaterialsByNotebook(session.user.id, id),
    listInteractionsByNotebook(session.user.id, id),
    listNotebookTopicsWithStatus(session.user.id, id),
  ]);

  const materials: Material[] = rawMaterials.map((m) => ({
    id: m.id,
    user_id: m.userId,
    notebook_id: m.notebookId,
    kind: m.kind as Material["kind"],
    display_name: m.displayName,
    source_uri: m.sourceUri,
    status: m.status as Material["status"],
    indexed_at: m.indexedAt?.toISOString() ?? null,
    created_at: m.createdAt.toISOString(),
    suggestions: m.suggestions ?? [],
  }));

  const notebookTopics: NotebookTopicStatus[] = notebookTopicsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    mastery_score: t.masteryScore,
    tier: t.tier,
    has_interacted: t.hasInteracted,
  }));

  const topicMap = new Map<string, TopicSnapshot>(
    notebookTopicsRaw.map((t) => [t.id, { id: t.id, name: t.name }]),
  );
  const replay = interactionsToUIMessages(interactions, topicMap);

  return (
    <NotebookDetail
      notebook={notebook}
      materials={materials}
      notebookTopics={notebookTopics}
      topicsExtracting={rawNotebook.topicsExtracting}
      initialMessages={replay.messages}
      initialInteractionId={replay.lastUnscoredId}
    />
  );
}
