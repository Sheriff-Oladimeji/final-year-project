# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Critical: Next.js version

This project uses **Next.js 16.2.4** with **React 19.2.4**. These are newer versions with breaking changes from what most training data covers. Before writing any routing, data-fetching, or Server Component code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices — APIs you know may have moved or been removed.

---

## Commands

Run all commands from `frontend/`.

```bash
npm run dev      # dev server → http://localhost:3000
npm run build    # production build (type-checks and compiles)
npm run start    # serve the production build
```

There is no lint script configured yet. TypeScript errors surface during `npm run build`.

To add a shadcn component:
```bash
npx shadcn@latest add <component-name>
```

---

## Architecture

### App Router + RSC

`components.json` has `"rsc": true` — components are Server Components by default. Add `"use client"` only when the component needs browser APIs, event handlers, or React hooks (`useState`, `useEffect`, etc.). Keep `"use client"` boundaries as deep in the tree as possible so Server Components above them can still stream.

### Path aliases

Configured in `tsconfig.json` and `components.json`:

| Alias | Resolves to |
|-------|-------------|
| `@/components` | `src/components/` |
| `@/components/ui` | `src/components/ui/` (shadcn output) |
| `@/lib` | `src/lib/` |
| `@/hooks` | `src/hooks/` |

### shadcn

Style is `radix-nova`, base colour `neutral`, CSS variables enabled. New components from `npx shadcn@latest add` land in `src/components/ui/`. The `cn()` utility in `src/lib/utils.ts` merges Tailwind classes — use it everywhere instead of string concatenation.

Icons come from `lucide-react`.

### Talking to the backend

The FastAPI backend runs on `http://localhost:8000` in development. A central config file (`src/lib/config.ts`) holds the API base URL and switches between dev and prod values — never hardcode the URL in components or fetch calls.

**Every fetch to the backend must include `credentials: "include"`** so the browser sends the `HttpOnly` session cookie cross-origin. The cookie is invisible to JavaScript by design — there is no token to store or attach manually.

```ts
// correct
fetch(`${API_BASE}/chat/ask`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})
```

### Auth flow

Students sign in via `GET /auth/google/start` (a full-page redirect to Google, not a fetch call). After OAuth the backend sets the session cookie and redirects to `/dashboard`. There is no token exchange in JavaScript.

The frontend checks auth state by calling `GET /auth/me` with `credentials: "include"`. A 401 response means the user is not signed in.

Admin signs in via `POST /auth/admin/login` with email + password (a fetch call, not a redirect).

### Folder conventions

```
src/
  app/              Route segments (App Router)
  components/
    ui/             shadcn-generated primitives — do not edit manually
    <feature>/      Composed components grouped by feature (e.g. chat/, materials/)
  hooks/            Custom React hooks (client-side only)
  lib/
    api/            Typed fetch wrappers, one file per backend module
    config.ts       API base URL and environment flags
    utils.ts        cn() and other pure utilities
  types/            Shared TypeScript interfaces mirroring backend schemas
```

Keep data-fetching logic in `src/lib/api/` files, not inline in components. Components receive data as props or call the typed wrappers — they do not construct raw fetch URLs.
