// Deliberately NOT in src/actions/materials.ts ("use server") — every export
// from a "use server" file becomes a publicly callable Next.js Server
// Action, and this function takes a raw userId with no session check, so
// exporting it there would expose an unauthenticated RPC letting any caller
// trigger extraction (and burn Gemini calls) against an arbitrary user's
// notebook. Callers that need auth (the upload actions) already have a
// verified session before calling this; scripts/backfill-topic-taxonomy.ts
// imports it directly for the same reason — no server action boundary to
// cross either way.

import { getNotebook, claimTopicsExtractionSlot, releaseTopicsExtractionSlot } from "@/db/queries/notebooks";
import { getOrCreateTopic, listNotebookTopicNames } from "@/db/queries/topics";
import { getLatestReadyMaterialIndexedAt } from "@/db/queries/materials";
import { extractNotebookTopics } from "@/lib/ai/suggestions";

export interface TaxonomyRunResult {
  ran: boolean;
  labelsSeeded: number;
}

// Keeps a notebook's topic taxonomy current as materials are added.
// claimTopicsExtractionSlot is a genuinely resettable mutex (unlike
// claimNotebookSummarySlot, see its comment in src/db/queries/notebooks.ts),
// so this can win the claim again on every new upload rather than only the
// first.
//
// Runs as a "drain loop" while holding the mutex: after finishing one pass,
// it checks whether any material became ready *during* that pass (a real
// race in a multi-file batch upload — material B can finish indexing while
// material A's extraction call is still in flight) and, if so, loops again
// before releasing, so the winning caller catches up with everything rather
// than leaving B's content permanently unextracted (B's own after() block
// will simply fail to claim the slot and no-op, trusting A to cover it).
//
// Critically, the stamp written to topicsExtractedAt on success is the
// snapshot taken immediately BEFORE that pass's Gemini call, never the
// wall-clock time the call finished — stamping completion time could mark a
// material that became ready mid-call as "covered" when it never actually
// was, silently dropping it forever. The pre-call snapshot instead biases
// toward one harmless extra Gemini call next time (extractNotebookTopics's
// reuse-existing-label instruction plus getOrCreateTopic's idempotency make
// a redundant pass a no-op) rather than a silently missed material.
export async function regenerateTopicTaxonomy(notebookId: string, userId: string): Promise<TaxonomyRunResult> {
  const latestReady = await getLatestReadyMaterialIndexedAt(userId, notebookId);
  if (!latestReady) return { ran: false, labelsSeeded: 0 };

  const nb = await getNotebook(notebookId, userId);
  if (!nb) return { ran: false, labelsSeeded: 0 };
  if (nb.topicsExtractedAt && nb.topicsExtractedAt >= latestReady) return { ran: false, labelsSeeded: 0 }; // already current

  const claimed = await claimTopicsExtractionSlot(notebookId, userId);
  if (!claimed) return { ran: false, labelsSeeded: 0 }; // another call is already draining

  const MAX_PASSES = 5; // safety valve — not expected to hit in practice at a 10-material cap
  let lastCovered: Date | null = null;
  let labelsSeeded = 0;

  try {
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const snapshot = await getLatestReadyMaterialIndexedAt(userId, notebookId);
      if (!snapshot) break;
      if (lastCovered && lastCovered >= snapshot) break; // caught up, nothing new since last pass

      const nbFresh = await getNotebook(notebookId, userId);
      if (!nbFresh) break;

      const existing = await listNotebookTopicNames(userId, notebookId);
      const labels = await extractNotebookTopics(notebookId, nbFresh.title, existing);
      if (labels.length > 0) {
        await Promise.all(labels.map((label) => getOrCreateTopic(userId, notebookId, label)));
        labelsSeeded += labels.length;
      }
      lastCovered = snapshot;
    }
  } finally {
    await releaseTopicsExtractionSlot(notebookId, userId, lastCovered);
  }

  return { ran: lastCovered !== null, labelsSeeded };
}
