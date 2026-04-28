# Frontend Setup

Step-by-step guide for running the frontend locally.

---

## Prerequisites

- **Node.js 20+** — check with `node -v`
- **npm** — comes with Node.js
- **Backend running** — the frontend talks to the FastAPI backend. Set it up first: see `../backend/SETUP.md`

---

## 1. Install dependencies

```bash
cd frontend
npm install
```

---

## 2. Environment variables

The only environment variable the frontend needs is the backend API URL.

In **development**, no configuration is needed — the app defaults to `http://localhost:8000`.

For **production** (e.g. Vercel), create a `.env.local` file:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
```

| Variable | Required | Default | What it does |
|----------|----------|---------|--------------|
| `NEXT_PUBLIC_API_URL` | No (dev) | `http://localhost:8000` | Base URL of the FastAPI backend |

The `NEXT_PUBLIC_` prefix makes this variable available in the browser (not just server-side). It's read in `src/lib/config.ts`.

---

## 3. Start the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`.

The landing page shows a "Sign in with Google" button and an admin login form. Neither will work until the backend is running and configured.

---

## 4. Verify it works

With the backend running at `localhost:8000`:

1. Visit `http://localhost:3000` — landing page renders
2. Click "Sign in with Google" — redirects to Google consent screen
3. After OAuth — lands on `/dashboard`
4. Upload a PDF at `/materials` — status goes `pending` → `ready`
5. Ask a question at `/chat` — guided question appears
6. Admin login — enter the seeded admin credentials, lands on `/admin/users`

---

## Production build

```bash
npm run build   # compiles and type-checks
npm run start   # serves the production build on port 3000
```

### CORS

The backend's `CORS_ORIGINS` setting must include your frontend's production URL. Edit `../backend/.env`:

```env
CORS_ORIGINS=["https://your-frontend-domain.com"]
```

### Cookie security

The backend sets `secure=False` on session cookies in development. For production, set `ENVIRONMENT=production` in `../backend/.env` — this switches the cookie to `secure=True` (HTTPS only).

---

## Adding shadcn components

```bash
npx shadcn@latest add <component-name>
```

Components land in `src/components/ui/`. Do not edit files in that folder manually — re-run the add command to update them.

Current installed components: `button`, `card`, `input`, `textarea`, `badge`, `progress`, `table`, `dialog`, `alert`, `skeleton`, `tabs`, `separator`, `avatar`, `select`, `label`.
