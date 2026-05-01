import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── users ────────────────────────────────────────────────────────────────────
// Students and admin in one table. role column differentiates them.
// CHECK constraint enforces exactly one auth method per row:
//   student → google_sub set, password_hash NULL
//   admin   → password_hash set, google_sub NULL
export const users = pgTable(
  "users",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    email:        varchar("email", { length: 255 }).notNull().unique(),
    role:         varchar("role", { length: 20 }).notNull().default("student"),
    googleSub:    varchar("google_sub", { length: 255 }).unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    disabledAt:   timestamp("disabled_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "ck_users_auth_method",
      sql`(${t.googleSub} IS NOT NULL AND ${t.passwordHash} IS NULL) OR
          (${t.googleSub} IS NULL AND ${t.passwordHash} IS NOT NULL)`,
    ),
  ],
);

// ── sessions ─────────────────────────────────────────────────────────────────
// One row per sign-in event. ended_at is NULL while the session is active.
// Interactions reference session_id so the admin log shows which login generated each question.
export const sessions = pgTable(
  "sessions",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt:   timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

// ── materials ─────────────────────────────────────────────────────────────────
// One row per uploaded PDF or YouTube video.
// status: "pending" → "ready" | "failed"
// Gemini Files expire after 48h:
//   PDFs    → saved to uploads/{userId}/{materialId}.pdf (localPath column)
//   YouTube → full transcript stored in content column
// getReadyMaterials() checks expiry and re-uploads from backup automatically.
export const materials = pgTable(
  "materials",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    userId:       uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind:         varchar("kind", { length: 20 }).notNull(),        // "pdf" | "youtube"
    displayName:  varchar("display_name", { length: 500 }).notNull(),
    sourceUri:    text("source_uri").notNull(),
    fileSearchId: varchar("file_search_id", { length: 500 }),       // Gemini Files API file name
    status:       varchar("status", { length: 20 }).notNull().default("pending"),
    indexedAt:    timestamp("indexed_at", { withTimezone: true }),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    localPath:    text("local_path"),   // relative path to saved PDF for re-upload
    content:      text("content"),      // full transcript for YouTube re-upload
  },
  (t) => [index("materials_user_id_idx").on(t.userId)],
);

// ── topics ────────────────────────────────────────────────────────────────────
// One row per (student, topic) pair. Topic name is free-form text from Gemini
// classifier (e.g. "binary search trees"). UNIQUE(user_id, name) prevents duplicates.
export const topics = pgTable(
  "topics",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    userId:       uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name:         varchar("name", { length: 255 }).notNull(),
    masteryScore: integer("mastery_score").notNull().default(0),    // always in [0, 100]
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_topics_user_name").on(t.userId, t.name),
    index("topics_user_id_idx").on(t.userId),
  ],
);

// ── interactions ──────────────────────────────────────────────────────────────
// One row per ask/reply cycle.
// Lifecycle:
//   1. askAction() creates row: correctness="unscored", student_reply=NULL
//   2. replyAction() updates:   correctness set, student_reply set, score_delta set
export const interactions = pgTable(
  "interactions",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    userId:           uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionId:        uuid("session_id").notNull().references(() => sessions.id),
    topicId:          uuid("topic_id").notNull().references(() => topics.id),
    question:         text("question").notNull(),
    // Stored so replyAction() uses the same context that generated the question
    retrievedContext: text("retrieved_context"),
    promptTemplate:   varchar("prompt_template", { length: 50 }).notNull(), // "recall"|"application"|"analysis"
    response:         text("response").notNull(),     // the guided question text
    studentReply:     text("student_reply"),
    correctness:      varchar("correctness", { length: 30 }).notNull().default("unscored"),
    scoreDelta:       integer("score_delta").notNull().default(0),
    createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("interactions_user_id_idx").on(t.userId),
    index("interactions_topic_id_idx").on(t.topicId),
    index("interactions_created_at_idx").on(t.createdAt),
  ],
);

// Type exports — inferred from schema, used throughout the app
export type User        = typeof users.$inferSelect;
export type Session     = typeof sessions.$inferSelect;
export type Material    = typeof materials.$inferSelect;
export type Topic       = typeof topics.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
