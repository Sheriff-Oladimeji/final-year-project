# Setup Guide

Everything runs from the `codebase/` directory.

---

## 1. Prerequisites

- Node.js 20+
- PostgreSQL running locally (or a hosted instance)
- A Resend account (resend.com) — free tier is fine
- A Google AI Studio API key for Gemini (aistudio.google.com)

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure environment variables

Edit `.env.local`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `BETTER_AUTH_SECRET` | Run: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Your app URL (http://localhost:3000 for dev) |
| `NEXT_PUBLIC_APP_URL` | Same as BETTER_AUTH_URL |
| `RESEND_API_KEY` | resend.com → API Keys |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key |

There's no admin credential to configure here — the admin account is
created through a one-time setup page after migrations run (Step 6).

Resend is only used for password-reset emails — it's not required for normal
sign-in. Without a verified domain you can only send to your own inbox on
the free tier.

---

## 4. Create the database

```bash
createdb learning_assistant
```

---

## 5. Run migrations

```bash
npm run db:generate   # generates SQL from src/db/schema.ts
npm run db:migrate    # applies to your database
```

Creates all tables: student auth tables (user, session, account, verification),
admin auth tables (admin_user, admin_session, admin_account, admin_verification —
a fully separate table set, not a shared role column), and app tables
(notebooks, materials, topics, interactions).

---

## 6. Create the admin account

Go to http://localhost:3000/admin/setup and fill in a name, email, and
password. This page only works once — the moment an admin account exists,
it locks itself and redirects to `/admin/login` instead, no matter how
it's reached. There's no script and nothing to put in `.env`.

---

## 7. Start the dev server

```bash
npm run dev
```

Visit http://localhost:3000

---

## How sign-in works

Students and admins sign in on separate pages with email + password —
they are not the same account system.

- **Students**: go to http://localhost:3000, use the "Create account" tab
  on first visit, then "Sign in" afterwards. Self-registration is open —
  no manual setup needed.
- **Admins**: go to http://localhost:3000/admin/login. There is no sign-up
  tab here — the only admin account is the one created through
  `/admin/setup` (Step 6), and that page can only be used once.

Both flows have a "Forgot password?" link that emails a reset link via
Resend.

---

## Useful commands

```bash
npm run dev           # dev server
npm run build         # production build + type-check
npm run db:generate   # regenerate migrations after schema changes
npm run db:migrate    # apply pending migrations
npm run db:studio     # open Drizzle Studio (visual DB browser)
```

---

## Students

Students self-register with email + password on the landing page. No
manual setup needed — there is no admin approval step.

---

## Changing the admin password

There's no reset script. Use the "Forgot password?" link on
`/admin/login` — it emails a reset link the same way the student flow
does. `/admin/setup` cannot be reused once an admin account exists.

---

## Production checklist

- [ ] Set BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL to your real domain
- [ ] Verify sending domain in Resend (used for password-reset emails)
- [ ] Use a strong BETTER_AUTH_SECRET (32+ random chars)
- [ ] Point DATABASE_URL to production DB
- [ ] Run db:migrate against production DB
- [ ] Visit /admin/setup once to create the real admin account
