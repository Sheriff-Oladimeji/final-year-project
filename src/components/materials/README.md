# `src/components/materials/`

## `MaterialsPage.tsx`

Full client-side materials management page (`"use client"`). Handles upload, listing, status polling, and deletion.

---

## Upload flows

### PDF
1. Hidden `<input type="file" accept="application/pdf">` triggered by a button click
2. Calls `uploadPdf(file)` from `src/lib/api/materials.ts` — uses `FormData`, not JSON, because the backend expects multipart
3. On success: prepend the new material to the local `materials` state (instant UI update without refetch)
4. The new material starts with `status: "pending"` — polling takes over

### YouTube
1. URL `<input>` + form submit
2. Calls `submitYoutube(url)` — validates on the backend (transcript must exist)
3. On `422` error: shows "Could not extract transcript. Make sure the video has captions enabled."
4. On success: same as PDF — prepend to local state, polling starts

---

## Status polling

After any upload, some materials will have `status: "pending"` while Gemini indexes them in the background (typically 10–30 seconds for a PDF, faster for YouTube).

```
useEffect runs whenever pendingIds.length changes
  → if pendingIds.length > 0: start setInterval(fetchMaterials, 3000)
  → if pendingIds.length === 0: cleanup interval
```

`fetchMaterials()` calls `GET /materials/` and overwrites the full list. When all materials settle to `"ready"` or `"failed"`, the interval clears itself.

---

## Delete

Each material row has a `<Dialog>` confirm modal before calling `DELETE /materials/{id}`. On success, the item is removed from local state immediately — no refetch needed.

---

## Status badges

| Status | Icon | Colour |
|--------|------|--------|
| `pending` | Spinning loader | Gray |
| `ready` | Check circle | Green |
| `failed` | X circle | Red |
