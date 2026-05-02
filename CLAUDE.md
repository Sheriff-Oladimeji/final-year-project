# CLAUDE.md

This file provides guidance to Claude Code when working in this directory.

---

## Critical: Next.js version

This project uses **Next.js 16.2.4** with **React 19.2.4**. Before writing routing or
data-fetching code, check `node_modules/next/dist/docs/` — conventions may differ from
training data.

---

## Commands

Run all from `codebase/`.

```bash
npm run dev           # dev server → http://localhost:3000
npm run build         # production build (also type-checks)
npm run db:generate   # generate Drizzle migrations
npm run db:migrate    # apply migrations
npm run db:studio     # visual DB browser
npm run seed:admin    # create/promote admin user
```

---

## What this app is

Multimodal AI learning assistant (B.Sc. thesis). Students upload PDFs and YouTube videos,
then ask questions. Instead of direct answers, Gemini returns guided questions calibrated
to the student's mastery level (recall → application → analysis). Students reply, get
scored, and track topic mastery over time.

Two roles: **student** and **admin**.

---

## Auth — Better Auth + magic links

Authentication is handled entirely by **Better Auth** (`src/lib/auth.ts`).

- **No passwords.** Everyone signs in via magic link (email → link → signed in).
- Magic links are sent via **Resend**.
- Better Auth manages the `user`, `session`, `account`, `verification` tables.
- Role (`student` | `admin`) is a custom field on the `user` table.
- Server-side session: `await auth.api.getSession({ headers: await headers() })`
- Client-side signout: `authClient.signOut()` from `@/lib/auth-client`
- All BA routes are handled by `src/app/api/auth/[...all]/route.ts`

---

## Architecture

### Stack
- **Next.js 16** App Router, RSC-first
- **Drizzle ORM** + **postgres** driver (no ORM abstraction layer)
- **Better Auth** — sessions, magic links
- **Google GenAI SDK** (`@google/genai`) — Gemini 2.5 Flash
- **Resend** — transactional email
- **shadcn** (radix-nova style, neutral base)

### Folder layout

```
src/
  app/
    api/auth/[...all]/   Better Auth catch-all handler
    (student)/           Student route group (auth-guarded)
    (admin)/             Admin route group (auth-guarded)
    page.tsx             Landing page with magic link form
  actions/               Server Actions ("use server")
    auth.ts              logoutAction
    materials.ts         upload/delete materials
    chat.ts              askAction, replyAction
    admin.ts             disableUserAction, deleteUserAction
  components/
    ui/                  shadcn primitives (do not edit)
    auth/                MagicLinkForm
    chat/                ChatThread
    materials/           MaterialsPage
    dashboard/           TopicCard, Sparkline
    admin/               UserActions, InteractionFilters
    nav/                 StudentNav, AdminNav, LogoutButton
  db/
    schema.ts            All Drizzle table definitions
    index.ts             DB client singleton
    queries/             One file per table — pure async query fns
  lib/
    auth.ts              Better Auth server instance
    auth-client.ts       Better Auth client (browser-side)
    mastery.ts           Scoring rules (pure functions)
    youtube.ts           Transcript fetching
    uploads.ts           PDF disk helpers
    utils.ts             cn() utility
    gemini/
      client.ts          GoogleGenAI singleton
      files.ts           Files API wrappers + expiry handling
      prompts.ts         5 prompt templates
      pipeline.ts        ask() / reply() orchestration
  types/
    index.ts             TypeScript interfaces (snake_case for UI layer)
```

### Session pattern

Every Server Action and server-rendered page that needs auth does:

```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({ headers: await headers() });
if (!session) redirect("/");
// session.user.id, session.user.role, session.user.disabledAt, session.session.id
```

### DB query convention

All queries are plain async functions in `src/db/queries/`. They never throw HTTP errors —
they return data or null. Error handling is in the Server Actions.

### Gemini pipeline

`pipeline.ts` exports `ask(question, userId, sessionId?)` and `reply(...)`.
Both use `Promise.all` for the concurrent Gemini calls (topic classify + context retrieve).
The `sessionId` from the Better Auth session is passed in from the action and stored in
the `interactions` table for audit purposes.
