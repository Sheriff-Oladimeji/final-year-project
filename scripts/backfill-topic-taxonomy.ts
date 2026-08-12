/**
 * One-off backfill: extracts topic taxonomies for pre-existing notebooks
 * that won't otherwise receive another material upload (extraction now runs
 * automatically on every upload via regenerateTopicTaxonomy — see
 * src/lib/ai/topic-taxonomy.ts — so this script is only needed for
 * notebooks whose material set is already final).
 *
 * Thin wrapper around the real regenerateTopicTaxonomy() action, not a
 * parallel reimplementation — that function's own claim-slot and
 * "already current" skip-check make it safe to call directly for any
 * notebook, old or new, so this script doesn't need its own dedup/quality
 * logic. The store/ready-material checks below exist purely for readable
 * per-notebook skip stats in the log output.
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
  const { regenerateTopicTaxonomy } = await import("@/lib/ai/topic-taxonomy");

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
    processed: 0,
    skippedNoStore: 0,
    skippedNoReadyMaterial: 0,
    skippedAlreadyCurrent: 0,
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

      if (DRY_RUN) {
        console.log(`[${nb.id}] "${nb.title}" — would extract (dry run)`);
        continue;
      }

      const result = await regenerateTopicTaxonomy(nb.id, nb.userId);
      if (!result.ran) {
        stats.skippedAlreadyCurrent++;
        continue;
      }
      console.log(`[${nb.id}] "${nb.title}" — seeded ${result.labelsSeeded} topic label(s)`);
      stats.processed++;

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
