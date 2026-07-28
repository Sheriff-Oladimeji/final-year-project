# `src/components/auth/`

Authentication UI components. Students and admins are two fully separate
Better Auth instances with independent database tables — see
`src/lib/auth.ts` and `src/lib/admin-auth.ts`. There is no shared `role`
check between them; an admin session simply cannot exist for a student
account, and vice versa.

---

## `SignInForm.tsx`

Client Component. Two tabs: sign in and create account, both email +
password. Used on the landing page (`src/app/page.tsx`). Talks to
`authClient` (`@/lib/auth-client`), which hits `/api/auth/*`.

Students self-register here — there is no separate sign-up flow.

---

## `AdminLoginForm.tsx`

Client Component. Plain email + password, no sign-up tab. Used on
`/admin/login`. Talks to `adminAuthClient` (`@/lib/admin-auth-client`),
which hits `/api/auth/admin/*` — a distinct cookie (`admin-auth.*` prefix)
from the student session, so a browser can hold both at once.

Admin accounts are never created through this form — see
`AdminSetupForm.tsx` below for the only way a row appears in `adminUser`.

---

## `AdminSetupForm.tsx`

Client Component. Name + email + password — creates the one and only
admin account. Used on `/admin/setup`, which only renders while
`countAdminUsers()` is zero (`src/db/queries/admin-users.ts`). The
enforcement isn't the page redirect — it's the same count re-checked
inside `createFirstAdminAction` (`src/actions/admin-setup.ts`), so
submitting straight to the action can't create a second admin either.

---

## `ForgotPasswordForm.tsx` / `ResetPasswordForm.tsx`

Shared components, parameterized by which auth client to use (`client`
prop) so the same UI serves both the student and admin recovery flows:

- `src/app/forgot-password` + `src/app/reset-password` (student)
- `src/app/admin/forgot-password` + `src/app/admin/reset-password` (admin)

They call the raw `/request-password-reset` and `/reset-password`
endpoints via `client.$fetch(...)` rather than a named convenience method,
since the endpoint path and body shape are what's actually documented —
safer than depending on a client method name.

---

## Auth guard pattern

- `(student)/layout.tsx` guards student routes via `auth.api.getSession()`,
  redirecting to `/` if there's no session or the account is banned.
- `(admin)/layout.tsx` guards admin routes via `adminAuth.api.getSession()`,
  redirecting to `/admin/login` if there's no session.

Both run server-side before any page content is sent to the browser.
