# `src/components/admin/`

Client components for the admin panel. Both are `"use client"` because they trigger API calls in response to user actions and need `router.refresh()` to re-fetch server-rendered data after mutations.

---

## `UserActions.tsx`

Rendered inside each row of the users table. Contains two actions:

**Disable**
- Calls `POST /admin/users/{id}/disable`
- Sets `disabled_at` on the user row — they can no longer sign in
- Idempotent: button is grayed out and labelled "Disabled" if `user.disabled_at` is already set
- On success: `router.refresh()` re-fetches the server-rendered user list

**Delete** (irreversible)
- Opens a `<Dialog>` confirmation modal before proceeding
- Calls `DELETE /admin/users/{id}` — cascades through all their materials, topics, and interactions on the backend
- On success: `router.refresh()`

---

## `InteractionFilters.tsx`

Filter bar for the admin interactions page. Filters are stored in the URL as query params — this lets the server page read them and pass them to `GET /admin/interactions` at render time.

| Filter | Query param | Backend support |
|--------|-------------|----------------|
| Correctness | `correctness` | Client-side (filtered after fetch) |
| Template | `template` | Client-side (filtered after fetch) |
| From date | `from_dt` | Sent to backend |
| To date | `to_dt` | Sent to backend |

When a filter changes, `router.push()` updates the URL and the server page re-renders with the new params. Selecting "All" or clearing a date removes that param from the URL.

The component must be wrapped in `<Suspense>` in the server page because it calls `useSearchParams()`, which requires a Suspense boundary in Next.js 16.
