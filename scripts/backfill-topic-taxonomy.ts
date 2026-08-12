/**
 * One-off backfill: seeds pre-existing notebooks with a topic taxonomy
 * extracted from their materials' own structure.
 *
 * Why this exists: regenerateNotebookSummary() (src/actions/materials.ts)
 * only extracts + seeds topics on a notebook's FIRST ready material, going
 * forward from when that code shipped. Every notebook created before then —
 * including live usability-study testers' notebooks — already has
 * `summary` set from the old two-field prompt, so claimNotebookSummarySlot
 * refuses to re-claim for them. Going through the normal action would
 * silently no-op for almost every existing notebook. This script bypasses
 * the claim-slot entirely and calls generateNotebookSummary() directly,
 * using ONLY the returned `topics` — it deliberately does NOT touch
 * `summary`/`suggestions`, since overwriting an already-reviewed,
 * currently-displayed summary mid-study is not something this script
 * should do.
 *
 * NOT gated on "notebook already has topic rows" — every actively-used
 * notebook already has at least one ad-hoc topic from the old free-form
 * classifier (that's precisely the merged-topic bug this backfill exists to
 * fix), so that guard would skip exactly the notebooks that need it most.
 * Re-running this script is safe (idempotent via getOrCreateTopic's
 * onConflictDoNothing — no duplicate rows) but wasteful (spends a Gemini
 * call per notebook again); it's a manual, occasionally-run script, not
 * something scheduled, so that tradeoff is fine.
 *
 * Runs sequentially with a short delay between notebooks, not in parallel —
 * deliberately avoids reproducing the concurrent-Gemini/DB-pool exhaustion
 * incident from 2026-08-11 (see the comment above regenerateNotebookSummary
 * in src/actions/materials.ts).
 *
 * Usage:
 *   npm run topics:backfill -- --dry-run
 *   npm run topics:backfill -- --notebook-id=<uuid>
 *   npm run topics:backfill
 */

import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "..", ".env") });

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const ONLY_ID = [...args].find((a) => a.startsWith("--notebook-id="))?.split("=")[1];

async function main() {
  // Dynamic imports only after loadEnv() runs — a static top-level import
  // of @/db would evaluate its module body (which reads process.env.DATABASE_URL
  // at construction time) before this script's own loadEnv() call executes.
  const { db } = await import("@/db");
  const { notebooks, materials } = await import("@/db/schema");
  const { eq, and, count } = await import("drizzle-orm");
  const { generateNotebookSummary } = await import("@/lib/ai/suggestions");
  const { getOrCreateTopic } = await import("@/db/queries/topics");

  const all = await db
    .select({
      id: notebooks.id,
      userId: notebooks.userId,
      title: notebooks.title,
      storeName: notebooks.fileSearchStoreName,
    })
    .from(notebooks);
  const targets = ONLY_ID ? all.filter((n) => n.id === ONLY_ID) : all;

  if (targets.length === 0) {
    console.log(ONLY_ID ? `No notebook found with id ${ONLY_ID}.` : "No notebooks found.");
    return;
  }

  const stats = {
    seeded: 0,
    skippedNoStore: 0,
    skippedNoReadyMaterial: 0,
    skippedThinExtraction: 0,
    failed: 0,
  };

  for (const nb of targets) {
    try {
      if (!nb.storeName) {
        stats.skippedNoStore++;
        continue;
      }

      const [{ n: readyCount }] = await db
        .select({ n: count() })
        .from(materials)
        .where(and(eq(materials.notebookId, nb.id), eq(materials.status, "ready")));
      if (readyCount === 0) {
        stats.skippedNoReadyMaterial++;
        continue;
      }

      console.log(`[${nb.id}] "${nb.title}" — extracting taxonomy${DRY_RUN ? " (dry run)" : ""}...`);
      if (DRY_RUN) continue;

      const result = await generateNotebookSummary(nb.id, nb.title);
      if (!result || result.topics.length < 3) {
        console.warn(`  fewer than 3 usable topics extracted — skipping (material likely lacks clear structure)`);
        stats.skippedThinExtraction++;
        continue;
      }

      for (const label of result.topics) {
        await getOrCreateTopic(nb.userId, nb.id, label); // already normalized by generateNotebookSummary
      }
      console.log(`  seeded ${result.topics.length} topics: ${result.topics.join(", ")}`);
      stats.seeded++;

      // Gentle pacing between notebooks — sequential, not Promise.all.
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      stats.failed++;
      console.error(`[${nb.id}] failed:`, err);
    }
  }

  console.log("\n", stats);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
