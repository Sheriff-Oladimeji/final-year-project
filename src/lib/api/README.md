# `src/lib/api/`

Typed fetch wrappers — one file per backend module. All HTTP calls to the FastAPI backend go through this layer. Components never construct raw fetch URLs.

---

## How it works

### `client.ts` — the base fetch wrapper

```ts
request<T>(path, init?) → Promise<T>
```

Every wrapper function calls `request()`. It automatically:
- Prepends `API_BASE` (from `src/lib/config.ts`) to the path
- Sets `credentials: "include"` on every request (sends the `HttpOnly` session cookie cross-origin)
- Sets `Content-Type: application/json` by default (overridden for multipart uploads)
- Throws `ApiError` on non-ok responses with the status code and `detail` message from FastAPI

```ts
export class ApiError extends Error {
  constructor(public status: number, message: string)
}
```

Catch `ApiError` in components to handle specific HTTP errors:

```ts
try {
  await adminLogin(email, password);
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    // Wrong password
  }
}
```

---

## Files

| File | Wraps |
|------|-------|
| `auth.ts` | `GET /auth/me`, `POST /auth/admin/login`, `POST /auth/logout` |
| `materials.ts` | `GET /materials/`, `POST /materials/pdf`, `POST /materials/youtube`, `DELETE /materials/{id}` |
| `chat.ts` | `POST /chat/ask`, `POST /chat/reply` |
| `dashboard.ts` | `GET /dashboard/topics`, `GET /dashboard/topics/{id}/interactions` |
| `admin.ts` | `GET /admin/users`, `POST /admin/users/{id}/disable`, `DELETE /admin/users/{id}`, `GET /admin/interactions` |

---

## PDF upload is special

`uploadPdf()` in `materials.ts` does **not** use `request()` because multipart uploads must not have a `Content-Type: application/json` header — the browser needs to set it with the multipart boundary. It calls `fetch()` directly with `credentials: "include"` and a `FormData` body.

---

## Student sign-in is NOT a fetch

`GET /auth/google/start` is a full-page redirect to Google. It must be an `<a>` tag pointing to `${API_BASE}/auth/google/start`, not a `fetch()` call. A fetch would silently follow the redirect to Google and fail with a CORS error.
