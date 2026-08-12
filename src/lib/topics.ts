// Normalizes a raw topic label from any source (per-question classify call,
// notebook taxonomy extraction, backfill script) into the canonical form
// stored in topics.name. Every caller of getOrCreateTopic MUST run its label
// through this first, or case/whitespace variants silently bypass the
// (userId, notebookId, name) unique index and fragment mastery tracking.
export function normalizeTopicLabel(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\.$/, "")
    .replace(/\s+/g, " ")
    .slice(0, 100);
}
