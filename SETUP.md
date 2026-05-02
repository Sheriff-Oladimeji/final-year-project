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
| `EMAIL_FROM` | Verified Resend sender, e.g. `LearnAI <noreply@yourdomain.com>` |
| `GEMINI_API_KEY` | aistudio.google.com → Get API key |
| `ADMIN_EMAIL` | The email address you want as admin |

Resend free-tier note: without a verified domain you can only send to your own inbox.
For local testing set EMAIL_FROM to `onboarding@resend.dev`.

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

Creates all tables: Better Auth tables (user, session, account, verification)
and app tables (materials, topics, interactions).

---

## 6. Create the admin account

```bash
npm run seed:admin
```

This reads ADMIN_EMAIL from .env.local and creates a user with role="admin".
The admin signs in via magic link — no password needed.

---

## 7. Start the dev server

```bash
npm run dev
```

Visit http://localhost:3000

---

## How sign-in works

1. Go to http://localhost:3000
2. Enter your email address
3. Click "Send sign-in link"
4. Open the email, click the link (expires in 5 minutes)
5. You are signed in automatically:
   - Students go to /dashboard
   - Admins go to /admin/users

---

## Useful commands

```bash
npm run dev           # dev server
npm run build         # production build + type-check
npm run db:generate   # regenerate migrations after schema changes
npm run db:migrate    # apply pending migrations
npm run db:studio     # open Drizzle Studio (visual DB browser)
npm run seed:admin    # create or promote admin user
```

---

## Students

Students self-register on first sign-in. When a new email requests a magic
link and no account exists, Better Auth creates a new user with role="student".
No manual setup needed.

---

## Promoting a user to admin

Set ADMIN_EMAIL to their address and run:

```bash
npm run seed:admin
```

If they already exist their role is updated to admin.

---

## Production checklist

- [ ] Set BETTER_AUTH_URL and NEXT_PUBLIC_APP_URL to your real domain
- [ ] Verify sending domain in Resend, update EMAIL_FROM
- [ ] Use a strong BETTER_AUTH_SECRET (32+ random chars)
- [ ] Point DATABASE_URL to production DB
- [ ] Run db:migrate against production DB
- [ ] Run seed:admin with your real admin email
