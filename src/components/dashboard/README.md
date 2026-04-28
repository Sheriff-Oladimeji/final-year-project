# `src/components/dashboard/`

Components for the student mastery dashboard.

---

## `TopicCard.tsx`

Server Component. Displays a single topic's mastery data as a card.

Shows:
- **Topic name** (from Gemini's topic classifier — free-form text like "binary search trees")
- **Mastery score** (0–100, large number)
- **Progress bar** — visual representation of the score
- **Tier badge** — colour-coded label based on the score range:

| Tier | Score range | Badge colour |
|------|-------------|-------------|
| Recall | 0–30 | Blue |
| Application | 31–60 | Amber |
| Analysis | 61–100 | Green |

- **Sparkline** — thin SVG line chart of the last 10 score changes

---

## `Sparkline.tsx`

Client Component (`"use client"`). Renders a small SVG polyline from `ScoreHistoryEntry[]`.

Input: `history` — array of `{ score_delta, correctness, created_at }` (last 10 scored interactions for the topic).

The line colour reflects the most recent delta: green for positive, red for negative, gray for zero. The Y axis maps the full range of deltas in the history to the component's height so the line always fills the space.

Returns `null` if history has fewer than 2 entries (can't draw a line from a single point).

---

## Data flow

```
Dashboard page (Server Component)
  → GET /dashboard/topics
  → returns Topic[] ordered by mastery_score desc
  → maps to <TopicCard topic={t} />
    → <Sparkline history={topic.recent_history} />
```

The `recent_history` field on each topic contains the last 10 scored interactions pre-fetched by the backend — no additional API calls needed to render sparklines.
