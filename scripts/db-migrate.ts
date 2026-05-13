/**
 * Custom migration runner — replaces drizzle-kit migrate.
 *
 * Why we don't use drizzle-kit migrate directly:
 *   1. It uses the `postgres` driver against Neon, which silently hangs on
 *      cold-start handshakes and truncates stdout mid-run.
 *   2. Drizzle's transactional wrapper rolls back the *whole* migration on
 *      any error, but doesn't log the offending statement clearly, so we
 *      end up guessing which line failed.
 *   3. Drizzle's column-rename heuristic occasionally misfires (e.g. it
 *      treats a FK-target change as a rename), producing a migration that
 *      ALTERs the wrong constraint and leaves the DB half-migrated.
 *
 * What this runner does instead:
 *   - Connects via @neondatabase/serverless (same driver the app uses, so
 *     no behavior surprises between dev runtime and migrations).
 *   - Reads the canonical migration order from
 *     src/db/migrations/meta/_journal.json.
 *   - Checks which migrations are already recorded in
 *     drizzle.__drizzle_migrations and skips them.
 *   - Splits each pending file on `--> statement-breakpoint` and runs the
 *     statements one at a time, inside a transaction.
 *   - On error, classifies common drift conditions (e.g. column already
 *     exists, NOT NULL violation, FK violation when adding a column) and
 *     prints a clear remediation hint instead of dumping a generic stack.
 *   - With `--force-reset`, it pre-truncates the app data tables before
 *     applying the pending batch, so structural changes that conflict with
 *     existing rows can land cleanly. Auth tables are NEVER touched.
 *   - Writes the migration hash + timestamp into
 *     drizzle.__drizzle_migrations on success.
 *
 * Usage:
 *   npm run db:migrate              # apply pending migrations
 *   npm run db:migrate -- --force-reset  # truncate app tables first
 *   npm run db:migrate -- --verbose      # print every statement
 *   npm run db:migrate -- --dry-run      # show plan, run nothing
 *   npm run db:migrate -- --status       # list applied vs pending
 */

import { Pool, type PoolClient } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

// ── Load env ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const codebaseRoot = resolve(__dirname, "..");
loadEnv({ path: resolve(codebaseRoot, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✘ DATABASE_URL is not set in .env");
  process.exit(1);
}

const MIGRATIONS_DIR = resolve(codebaseRoot, "src/db/migrations");
const JOURNAL_PATH = resolve(MIGRATIONS_DIR, "meta/_journal.json");

// Tables we may safely truncate with --force-reset. NEVER include auth tables.
const RESETTABLE_TABLES = ["interactions", "topics", "materials", "notebooks"];

// ── Flags ───────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const FORCE_RESET = args.has("--force-reset");
const VERBOSE = args.has("--verbose");
const DRY_RUN = args.has("--dry-run");
const STATUS_ONLY = args.has("--status");

// ── Types ───────────────────────────────────────────────────────────────────

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);

    const journal = await readJournal();
    const appliedHashes = await readAppliedHashes(client);

    const plan = journal.entries.map((entry) => ({ entry, hash: "" as string }));
    for (const item of plan) {
      const filePath = resolve(MIGRATIONS_DIR, `${item.entry.tag}.sql`);
      const sql = await readFile(filePath, "utf-8");
      item.hash = sha256(sql);
    }

    const pending = plan.filter((item) => !appliedHashes.has(item.hash));

    if (STATUS_ONLY) {
      printStatus(plan, appliedHashes);
      return;
    }

    if (pending.length === 0) {
      console.log("✓ Database is up to date. Nothing to apply.");
      return;
    }

    console.log(`→ ${pending.length} pending migration${pending.length === 1 ? "" : "s"}:`);
    for (const item of pending) console.log(`    · ${item.entry.tag}`);

    if (DRY_RUN) {
      console.log("\n(dry run — no changes made)");
      return;
    }

    if (FORCE_RESET) {
      console.log("\n⚠ --force-reset: truncating app data tables before applying");
      await truncateAppTables(client);
    }

    for (const item of pending) {
      await applyMigration(client, item.entry, item.hash);
    }

    console.log(`\n✓ Applied ${pending.length} migration${pending.length === 1 ? "" : "s"}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

// ── Steps ───────────────────────────────────────────────────────────────────

async function ensureMigrationsTable(client: PoolClient) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle;`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);
}

async function readJournal(): Promise<Journal> {
  const raw = await readFile(JOURNAL_PATH, "utf-8");
  return JSON.parse(raw) as Journal;
}

async function readAppliedHashes(
  client: PoolClient,
): Promise<Set<string>> {
  const res = await client.query<{ hash: string }>(
    `SELECT hash FROM drizzle.__drizzle_migrations`,
  );
  return new Set(res.rows.map((r) => r.hash));
}

async function applyMigration(
  client: PoolClient,
  entry: JournalEntry,
  hash: string,
) {
  console.log(`\n→ Applying ${entry.tag}`);
  const filePath = resolve(MIGRATIONS_DIR, `${entry.tag}.sql`);
  const raw = await readFile(filePath, "utf-8");
  const statements = splitStatements(raw);

  await client.query("BEGIN");
  try {
    let savepointCounter = 0;
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      if (VERBOSE) console.log(`   ▸ ${preview(trimmed)}`);

      // Each statement runs inside its own SAVEPOINT so a recoverable error
      // (already-exists, does-not-exist on DROP) can be rolled back without
      // poisoning the outer transaction. Without this, Postgres aborts the
      // whole transaction on the first error.
      const savepoint = `mig_sp_${savepointCounter++}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      try {
        await client.query(trimmed);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        const handled = await handleStatementError(client, trimmed, err);
        if (!handled) throw err;
      }
    }
    await client.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [hash, Date.now()],
    );
    await client.query("COMMIT");
    console.log(`   ✓ ${entry.tag} applied (${statements.length} statements)`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`   ✘ ${entry.tag} failed — rolled back`);
    if (err instanceof Error) {
      console.error(`     ${err.message}`);
      printRemediation(err);
    }
    throw err;
  }
}

async function handleStatementError(
  _client: PoolClient,
  stmt: string,
  err: unknown,
): Promise<boolean> {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  const upperStmt = stmt.trim().toUpperCase();

  // Benign "object already exists" on idempotent CREATE/ADD operations.
  const benignAlreadyExists =
    message.includes("already exists") &&
    (upperStmt.startsWith("CREATE TABLE") ||
      upperStmt.startsWith("CREATE INDEX") ||
      upperStmt.startsWith("CREATE UNIQUE INDEX") ||
      upperStmt.startsWith("CREATE SCHEMA") ||
      upperStmt.includes("ADD COLUMN") ||
      upperStmt.includes("ADD CONSTRAINT"));
  if (benignAlreadyExists) {
    console.warn(`     ⚠ skipped (already exists): ${preview(stmt)}`);
    return true;
  }

  // Benign "does not exist" on DROPs — column or constraint already gone.
  const benignDoesNotExist =
    message.includes("does not exist") &&
    (upperStmt.includes("DROP COLUMN") ||
      upperStmt.includes("DROP CONSTRAINT") ||
      upperStmt.startsWith("DROP INDEX"));
  if (benignDoesNotExist) {
    console.warn(`     ⚠ skipped (does not exist): ${preview(stmt)}`);
    return true;
  }

  return false;
}

function printRemediation(err: Error) {
  const msg = err.message.toLowerCase();
  if (msg.includes("contains null values")) {
    console.error(
      `\n  hint: a new NOT NULL column was added to a table with existing rows.\n` +
        `        re-run with --force-reset to truncate app data tables and try again:\n` +
        `        npm run db:migrate -- --force-reset`,
    );
  } else if (msg.includes("violates foreign key constraint")) {
    console.error(
      `\n  hint: existing rows reference IDs that no longer exist in the parent table.\n` +
        `        re-run with --force-reset to wipe the conflicting data:\n` +
        `        npm run db:migrate -- --force-reset`,
    );
  } else if (msg.includes("column") && msg.includes("does not exist")) {
    console.error(
      `\n  hint: the migration tried to operate on a column the DB doesn't have.\n` +
        `        the schema and migrations may be out of sync. inspect the SQL file\n` +
        `        under src/db/migrations/ and fix the offending statement.`,
    );
  }
}

async function truncateAppTables(client: PoolClient) {
  // Truncate in FK-safe order using CASCADE. Wrapped in try/catch so a
  // missing table (first-time run) is non-fatal.
  for (const table of RESETTABLE_TABLES) {
    try {
      await client.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
      console.log(`   · truncated ${table}`);
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes("does not exist")) {
        console.log(`   · ${table} does not exist yet — skipped`);
      } else {
        throw err;
      }
    }
  }
}

function printStatus(
  plan: { entry: JournalEntry; hash: string }[],
  applied: Set<string>,
) {
  console.log(`Migrations in journal: ${plan.length}`);
  console.log(`Applied:               ${applied.size}\n`);
  for (const item of plan) {
    const mark = applied.has(item.hash) ? "✓" : "·";
    console.log(`  ${mark} ${item.entry.tag}`);
  }
  const pending = plan.filter((p) => !applied.has(p.hash)).length;
  console.log(`\nPending: ${pending}`);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function splitStatements(sql: string): string[] {
  // Drizzle inserts `--> statement-breakpoint` between logical statements.
  return sql
    .split(/-->\s*statement-breakpoint/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter((s) => s.length > 0);
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function preview(stmt: string): string {
  const oneLine = stmt.replace(/\s+/g, " ").trim();
  return oneLine.length > 100 ? `${oneLine.slice(0, 97)}…` : oneLine;
}

// ── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("\n✘ Migration aborted");
  if (err instanceof Error) console.error(err.message);
  process.exit(1);
});
