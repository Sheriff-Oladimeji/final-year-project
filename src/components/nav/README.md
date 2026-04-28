# `src/components/nav/`

Navigation components shared across route group layouts.

---

## `StudentNav.tsx`

Server Component. Top navigation bar for all student pages.

Links: Dashboard (`/dashboard`), Materials (`/materials`), Chat (`/chat`).

Contains `<LogoutButton />` on the right side.

Rendered by `src/app/(student)/layout.tsx`.

---

## `AdminNav.tsx`

Server Component. Top navigation bar for all admin pages.

Links: Users (`/admin/users`), Interactions (`/admin/interactions`).

Contains `<LogoutButton />` on the right side.

Rendered by `src/app/(admin)/layout.tsx`.

---

## `LogoutButton.tsx`

Client Component (`"use client"`). A button that calls `POST /auth/logout` then redirects to `/`.

The logout request clears the session cookie on the backend. Even if the request fails (e.g. session already expired), the redirect to `/` still happens — the auth guard on the next page will block access anyway.

Why Client Component: it needs `useRouter` for the redirect and `useState` for the loading state.
