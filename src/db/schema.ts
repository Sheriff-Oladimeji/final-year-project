import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── Better Auth tables ────────────────────────────────────────────────────────
// Column names and types MUST match what Better Auth expects exactly.
// Do NOT rename or reorder these — BA's Drizzle adapter maps to them by name.

export const user = pgTable("user", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  email:         text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image:         text("image"),
  createdAt:     timestamp("created_at").notNull(),
  updatedAt:     timestamp("updated_at").notNull(),
  role:          text("role").notNull().default("student"),
  isAdmin:       boolean("is_admin").notNull().default(false),
  disabledAt:    timestamp("disabled_at"),
});

export const session = pgTable("session", {
  id:          text("id").primaryKey(),
  expiresAt:   timestamp("expires_at").notNull(),
  token:       text("token").notNull().unique(),
  createdAt:   timestamp("created_at").notNull(),
  updatedAt:   timestamp("updated_at").notNull(),
  ipAddress:   text("ip_address"),
  userAgent:   text("user_agent"),
  userId:      text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id:                     text("id").primaryKey(),
  accountId:              text("account_id").notNull(),
  providerId:             text("provider_id").notNull(),
  userId:                 text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken:            text("access_token"),
  refreshToken:           text("refresh_token"),
  idToken:                text("id_token"),
  accessTokenExpiresAt:   timestamp("access_token_expires_at"),
  refreshTokenExpiresAt:  timestamp("refresh_token_expires_at"),
  scope:                  text("scope"),
  password:               text("password"),
  createdAt:              timestamp("created_at").notNull(),
  updatedAt:              timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id:         text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value:      text("value").notNull(),
  expiresAt:  timestamp("expires_at").notNull(),
  createdAt:  timestamp("created_at"),
  updatedAt:  timestamp("updated_at"),
});

// ── Application tables ────────────────────────────────────────────────────────

// A notebook is a container for up to 5 materials. Chat is scoped per notebook.
export const notebooks = pgTable(
  "notebooks",
  {
    id:                  uuid("id").primaryKey().defaultRandom(),
    userId:              text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    title:               varchar("title", { length: 255 }).notNull(),
    fileSearchStoreName: text("file_search_store_name"),
    createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notebooks_user_id_idx").on(t.userId)],
);

export const materials = pgTable(
  "materials",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    userId:       text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    notebookId:   uuid("notebook_id").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
    kind:         varchar("kind", { length: 20 }).notNull(),
    displayName:  varchar("display_name", { length: 500 }).notNull(),
    sourceUri:    text("source_uri").notNull(),
    fileSearchId: varchar("file_search_id", { length: 500 }),
    status:       varchar("status", { length: 20 }).notNull().default("pending"),
    indexedAt:    timestamp("indexed_at", { withTimezone: true }),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    localPath:    text("local_path"),
    content:      text("content"),
    suggestions:  text("suggestions").array().notNull().default(sql`ARRAY[]::text[]`),
  },
  (t) => [
    index("materials_user_id_idx").on(t.userId),
    index("materials_notebook_id_idx").on(t.notebookId),
  ],
);

// Topics are scoped per (user, notebook). Same name in different notebooks
// keeps separate mastery scores.
export const topics = pgTable(
  "topics",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    userId:       text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    notebookId:   uuid("notebook_id").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
    name:         varchar("name", { length: 255 }).notNull(),
    masteryScore: integer("mastery_score").notNull().default(0),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_topics_user_notebook_name").on(t.userId, t.notebookId, t.name),
    index("topics_user_id_idx").on(t.userId),
    index("topics_notebook_id_idx").on(t.notebookId),
  ],
);

export const interactions = pgTable(
  "interactions",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    userId:           text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    sessionId:        text("session_id"),
    notebookId:       uuid("notebook_id").notNull().references(() => notebooks.id, { onDelete: "cascade" }),
    topicId:          uuid("topic_id").notNull().references(() => topics.id),
    question:         text("question").notNull(),
    retrievedContext: text("retrieved_context"),
    promptTemplate:   varchar("prompt_template", { length: 50 }).notNull(),
    response:         text("response").notNull(),
    studentReply:     text("student_reply"),
    correctness:      varchar("correctness", { length: 30 }).notNull().default("unscored"),
    scoreDelta:       integer("score_delta").notNull().default(0),
    createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("interactions_user_id_idx").on(t.userId),
    index("interactions_topic_id_idx").on(t.topicId),
    index("interactions_notebook_id_idx").on(t.notebookId),
    index("interactions_created_at_idx").on(t.createdAt),
  ],
);

// Type exports
export type User        = typeof user.$inferSelect;
export type Session     = typeof session.$inferSelect;
export type Notebook    = typeof notebooks.$inferSelect;
export type Material    = typeof materials.$inferSelect;
export type Topic       = typeof topics.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
