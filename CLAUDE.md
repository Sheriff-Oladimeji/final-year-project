# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Critical: Next.js version

This project uses **Next.js 16.2.4** with **React 19.2.4**. These versions may have breaking changes from training data. Before writing routing, data-fetching, or Server Component code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

---

## Commands

Run all from `frontend/`.

```bash
npm run dev      # dev server → http://localhost:3000
npm run build    # production build (also type-checks)
npm run start    # serve production build
```

No lint script is configured — TypeScript errors surface at `npm run build`.

Add a shadcn component:
```bash
npx shadcn@latest add <component-name>
```

---

## What this app is

Multimodal AI learning assistant. Students upload PDFs and YouTube videos, then ask questions. Instead of direct answers the backend returns Gemini-generated guided questions calibrated to the student's mastery level (recall → application → analysis). Students reply, get scored, and track their topic mastery over time. An admin can manage users and view interaction logs.

Two roles: **student** (Google OAuth) and **admin** (email + password).

---

## Backend API (FastAPI, localhost:8000)

All requests require `credentials: "include"` — auth is a `HttpOnly` session cookie, invisible to JavaScript. Never store or attach a token manually.

| Method | Path | Who | What |
|--------|------|-----|------|
| GET | `/auth/google/start` | Student | Full-page redirect to Google (not a fetch call) |
| GET | `/auth/me` | Any | Returns current user or 401 |
| POST | `/auth/admin/login` | Admin | `{email, password}` → sets cookie |
| POST | `/auth/logout` | Any | Clears cookie |
| POST | `/materials/pdf` | Student | Multipart upload, returns `MaterialResponse` |
| POST | `/materials/youtube` | Student | `{url}` → `MaterialResponse` |
| GET | `/materials/` | Student | List of `MaterialResponse` |
| DELETE | `/materials/{id}` | Student | 204 |
| POST | `/chat/ask` | Student | `{question}` → `{guided_question, topic, interaction_id, citations}` |
| POST | `/chat/reply` | Student | `{interaction_id, reply, hint_requested}` → `{correctness, score_delta, new_score, next_guided_question, next_interaction_id}` |
| GET | `/dashboard/topics` | Student | Topic list with mastery scores and score history |
| GET | `/dashboard/topics/{id}/interactions` | Student | Interaction log for one topic |
| GET | `/admin/users` | Admin | User list (skip/limit) |
| POST | `/admin/users/{id}/disable` | Admin | Disable account |
| DELETE | `/admin/users/{id}` | Admin | Permanent delete |
| GET | `/admin/interactions` | Admin | Filtered log (user_id, topic_id, from, to, skip, limit) |

`MaterialResponse.status` cycles: `"pending"` → `"ready"` | `"failed"`.  
`Interaction.correctness` values: `"correct"`, `"correct_with_hint"`, `"incorrect"`, `"unscored"`.  
Mastery score is 0–100. Tiers: recall (0–30), application (31–60), analysis (61–100).

---

## Route structure

```
src/app/
  page.tsx                    Landing / login page (public)
  (student)/
    layout.tsx                Auth guard — redirects to / if not student
    dashboard/page.tsx        Topic mastery cards + sparklines
    materials/page.tsx        Upload PDF or YouTube, list materials
    chat/page.tsx             Ask question → guided question → reply loop
  (admin)/
    layout.tsx                Auth guard — redirects to / if not admin
    admin/users/page.tsx      User table with disable/delete
    admin/interactions/page.tsx  Filtered interaction log
  auth/
    callback/page.tsx         Landing page after Google OAuth redirect
```

The `(student)` and `(admin)` segments are route groups (parentheses = no URL segment). Their `layout.tsx` files call `GET /auth/me` and redirect if the role doesn't match.

---

## Architecture

### RSC-first

`components.json` has `"rsc": true` — all components are Server Components unless they opt in with `"use client"`. Add `"use client"` only for event handlers, hooks, or browser APIs. Keep the boundary as deep in the tree as possible.

### Path aliases

| Alias | Resolves to |
|-------|-------------|
| `@/components/ui` | `src/components/ui/` — shadcn output, do not edit manually |
| `@/components` | `src/components/` — feature components |
| `@/lib` | `src/lib/` |
| `@/hooks` | `src/hooks/` |

### Folder conventions

```
src/
  app/              Route segments
  components/
    ui/             shadcn primitives (auto-generated)
    chat/           Chat feature components
    materials/      Upload + materials list components
    dashboard/      Mastery card, sparkline, topic list
    admin/          User table, interaction log
  hooks/            Client-side custom hooks
  lib/
    api/            Typed fetch wrappers — one file per backend module
    config.ts       API_BASE URL (dev/prod switch)
    utils.ts        cn() utility
  types/            TypeScript interfaces matching backend response shapes
```

Data-fetching logic lives in `src/lib/api/` files. Components receive data as props or call typed wrappers — they never construct raw fetch URLs inline.

### shadcn

Style: `radix-nova`, base colour: `neutral`, CSS variables enabled. Icons: `lucide-react`. Use `cn()` from `src/lib/utils.ts` for all class merging.

### Auth flow

- **Student login:** link/button points to `GET /auth/google/start` — this is a full-page navigation, not `fetch()`. Google redirects back to `/auth/callback` which the backend then redirects to `/dashboard`.
- **Admin login:** `POST /auth/admin/login` with `credentials: "include"`.
- **Auth check:** `GET /auth/me` with `credentials: "include"` — 401 means not signed in.
- **Logout:** `POST /auth/logout` with `credentials: "include"`, then redirect to `/`.

### API base URL

`src/lib/config.ts` exports `API_BASE`. It uses `process.env.NEXT_PUBLIC_API_URL` when set (production) and falls back to `http://localhost:8000` for local dev. Never hardcode the URL elsewhere.

### Chat interaction loop

`/chat` page manages a stateful cycle:
1. Student types a question → POST `/chat/ask` → receive `guided_question` + `interaction_id`
2. Display guided question, student types reply → POST `/chat/reply` → receive `correctness` + `next_guided_question` + `next_interaction_id`
3. Step 2 repeats using the new `interaction_id` returned in each reply

The `interaction_id` threads the conversation — each reply produces the next question's ID.
