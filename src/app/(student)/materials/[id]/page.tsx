export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { getMaterial } from "@/db/queries/materials";
import { listInteractionsByMaterial } from "@/db/queries/interactions";
import { interactionsToUIMessages, type TopicSnapshot } from "@/lib/ai/history";
import { MaterialDetail } from "@/components/materials/MaterialDetail";
import type { Material } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MaterialPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const { id } = await params;
  const raw = await getMaterial(id, session.user.id);
  if (!raw) notFound();

  const material: Material = {
    id: raw.id,
    user_id: raw.userId,
    kind: raw.kind as Material["kind"],
    display_name: raw.displayName,
    source_uri: raw.sourceUri,
    status: raw.status as Material["status"],
    indexed_at: raw.indexedAt?.toISOString() ?? null,
    created_at: raw.createdAt.toISOString(),
    suggestions: raw.suggestions ?? [],
  };

  // Load history only when chat is usable.
  let initialMessages: Awaited<ReturnType<typeof interactionsToUIMessages>>["messages"] = [];
  let initialInteractionId: string | null = null;

  if (material.status === "ready") {
    const interactions = await listInteractionsByMaterial(session.user.id, material.id);

    if (interactions.length > 0) {
      const topicRows = await db
        .select({ id: topics.id, name: topics.name })
        .from(topics)
        .where(eq(topics.userId, session.user.id));
      const topicMap = new Map<string, TopicSnapshot>(
        topicRows.map((t) => [t.id, { id: t.id, name: t.name }]),
      );
      const replay = interactionsToUIMessages(interactions, topicMap);
      initialMessages = replay.messages;
      initialInteractionId = replay.lastUnscoredId;
    }
  }

  return (
    <MaterialDetail
      material={material}
      initialMessages={initialMessages}
      initialInteractionId={initialInteractionId}
    />
  );
}
