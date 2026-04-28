# `src/components/chat/`

## `ChatThread.tsx`

The entire chat interface in one Client Component (`"use client"`). It manages the conversation between student and AI.

---

## State

```ts
type Turn =
  | { type: "question"; content: string; topic: string; citations: Citation[]; interactionId: string }
  | { type: "reply";    content: string; correctness: Correctness; scoreDelta: number; newScore: number };
```

| State | What it holds |
|-------|--------------|
| `turns` | The full conversation history (question turns and reply turns interleaved) |
| `currentInteractionId` | The `interaction_id` from the last guided question — passed to the next `/chat/reply` call |
| `phase` | `"ask"` when waiting for the student's first question, `"reply"` after a guided question has been shown |
| `input` | Controlled textarea value |
| `loading` | True while waiting for a Gemini response |
| `error` | Error message string or `"no_materials"` sentinel |

---

## Interaction threading

This is how `interaction_id` flows through the conversation:

```
Student asks question
  → POST /chat/ask  { question }
  ← { guided_question, interaction_id: "id-1", topic, citations }
     push question turn with interactionId = "id-1"
     set currentInteractionId = "id-1"
     set phase = "reply"

Student types reply
  → POST /chat/reply  { interaction_id: "id-1", reply }
  ← { correctness, score_delta, new_score, next_guided_question, next_interaction_id: "id-2" }
     push reply turn
     push next question turn with interactionId = "id-2"
     set currentInteractionId = "id-2"
     phase stays "reply"

Student types next reply
  → POST /chat/reply  { interaction_id: "id-2", reply }
  ...
```

Each reply automatically returns the next guided question with its own `interaction_id`. The loop continues indefinitely.

---

## Error cases

| Error | Cause | UI |
|-------|-------|----|
| `ApiError(422)` | Student has no indexed materials | Inline alert with link to `/materials` |
| `ApiError(429)` | Rate limit exceeded (30 asks/min) | Inline alert with wait message |
| Any other | Network or server error | Generic inline alert |

---

## Sub-components (internal to the file)

- `QuestionBubble` — renders the AI's guided question, topic badge, and citations accordion
- `ReplyBubble` — renders the student's answer with correctness badge and score delta
- `CitationsAccordion` — collapsible list of source passages used to generate the question

Enter key submits (Shift+Enter for new line). The textarea placeholder switches between "Ask a question…" and "Type your answer…" based on `phase`.
