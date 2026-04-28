# `src/components/auth/`

Authentication UI components.

---

## `AdminLoginForm.tsx`

Client Component (`"use client"`). Renders email + password fields and calls `POST /auth/admin/login` on submit.

On success: `router.push("/admin/users")`.

Error handling:
- `401` → "Invalid email or password."
- `429` → "Too many attempts. Try again in a minute." (backend rate-limits to 5/min)
- anything else → generic error message

---

## Student sign-in — no component needed

The Google OAuth button is an `<a>` tag on the landing page (`src/app/page.tsx`), not a component. It points directly to `${API_BASE}/auth/google/start` which triggers a full-page navigation to Google's consent screen. After approval, Google redirects back to the backend callback, which sets the session cookie and redirects to `/dashboard`.

There is no token to handle in JavaScript — the browser manages the `HttpOnly` cookie automatically.

---

## Auth guard pattern

The `(student)/layout.tsx` and `(admin)/layout.tsx` route group layouts act as guards. Each calls `getMe()` server-side:

- If the user is unauthenticated (401) → `redirect("/")`
- If the user has the wrong role → `redirect("/")`
- Otherwise → render children

This runs on the server before any page content is sent to the browser.
