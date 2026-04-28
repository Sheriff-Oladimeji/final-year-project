# LearnAI — Frontend

Next.js 16 frontend for the multimodal AI learning assistant (B.Sc. thesis project, UNIOSUN Osogbo).

## What this app does

Students sign in with Google, upload course materials (PDFs or YouTube videos), and chat with an AI tutor. Instead of direct answers, the AI generates guided questions calibrated to each student's mastery level. Students reply, get scored, and track their progress on a topic-by-topic dashboard.

Admins sign in with email + password, manage user accounts, and browse the full interaction log.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn (radix-nova style)

**Backend:** FastAPI running on `localhost:8000` — see `../backend/` for setup.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Set the API URL (only needed in production — dev defaults to localhost:8000)
cp .env.example .env.local
# edit .env.local if needed

# 3. Start the dev server
npm run dev
# → http://localhost:3000
```

Full setup instructions including environment variables: **[SETUP.md](SETUP.md)**

---

## Commands

```bash
npm run dev      # dev server with hot reload
npm run build    # production build (also type-checks)
npm run start    # serve the production build
```

Add a shadcn component:
```bash
npx shadcn@latest add <component-name>
```

---

## How it's structured

```
src/
  app/               Next.js App Router — one folder per route
  components/        UI components grouped by feature
  lib/
    api/             Typed fetch wrappers (one per backend module)
    config.ts        API base URL with dev/prod switch
    utils.ts         cn() utility for merging Tailwind classes
  types/             TypeScript interfaces matching backend response shapes
```

### Route layout

```
/                        Landing page — Google sign-in + admin login
/dashboard               Student: topic mastery cards
/materials               Student: upload PDFs and YouTube videos
/chat                    Student: ask questions, receive guided questions, reply
/admin/users             Admin: user list with disable/delete
/admin/interactions      Admin: full interaction log with filters
```

The `(student)` and `(admin)` folders are Next.js route groups — they add auth guard layouts without changing the URL. `(student)/layout.tsx` calls `/auth/me` server-side and redirects to `/` if the user is not a student. `(admin)/layout.tsx` does the same for admins.

---

## Key things to know

### Auth is a cookie — not a token

The backend sets an `HttpOnly` session cookie on login. JavaScript cannot read it. Every fetch to the backend must include `credentials: "include"` or the cookie won't be sent. All of this is handled by `src/lib/api/client.ts` — the typed wrappers in `src/lib/api/` use it automatically.

Student sign-in (`/auth/google/start`) is a **full-page navigation**, not a `fetch()` call. It must be an `<a>` tag or `window.location`, not a fetch.

### Server Components by default

All components are Server Components unless they have `"use client"` at the top. Pages that fetch backend data at render time are Server Components. Pages that need interactivity (chat, materials upload, admin actions) use Client Components for the stateful parts only.

All server-rendered pages that hit the backend are marked `export const dynamic = "force-dynamic"` so Next.js doesn't try to pre-render them at build time.

### Chat interaction threading

`/chat/ask` returns a `guided_question` and an `interaction_id`. When the student replies, `/chat/reply` takes that `interaction_id` and returns the correctness score plus a `next_interaction_id` for the next question. The chat page (`ChatThread.tsx`) tracks `currentInteractionId` in state and threads each reply to the right question this way.

---

## Module READMEs

| Folder | README | What it covers |
|--------|--------|---------------|
| `src/lib/api/` | [src/lib/api/README.md](src/lib/api/README.md) | How the API client works, credential handling, error types |
| `src/components/auth/` | [src/components/auth/README.md](src/components/auth/README.md) | Admin login form, Google OAuth button pattern |
| `src/components/chat/` | [src/components/chat/README.md](src/components/chat/README.md) | Chat state machine, turn types, interaction threading |
| `src/components/materials/` | [src/components/materials/README.md](src/components/materials/README.md) | Upload flow, status polling, delete confirmation |
| `src/components/dashboard/` | [src/components/dashboard/README.md](src/components/dashboard/README.md) | Topic cards, sparkline data format |
| `src/components/admin/` | [src/components/admin/README.md](src/components/admin/README.md) | User actions, interaction log filters |
| `src/components/nav/` | [src/components/nav/README.md](src/components/nav/README.md) | Navigation components, logout flow |
