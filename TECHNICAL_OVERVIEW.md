# Technical Overview — LearnAI

How the system is built, what each service does, and how every piece connects. Written so you can explain it clearly to anyone who asks — examiner, supervisor, peer.

---

## The Stack at a Glance

| Layer | Tool | What it does |
|---|---|---|
| Frontend | Next.js 16 (App Router) | Renders the UI, handles routing |
| UI components | shadcn/ui + Tailwind CSS | Design system — buttons, dialogs, cards |
| AI streaming | Vercel AI SDK v6 | Connects to Gemini, streams responses to the browser |
| AI model | Gemini 2.5 Flash | The language model that reads sources and generates answers |
| Vector store | Gemini File Search Stores | Indexes uploaded documents for semantic retrieval |
| Database | PostgreSQL (Neon serverless) | Stores users, notebooks, interactions, mastery scores |
| ORM | Drizzle ORM | Type-safe queries — no raw SQL in application code |
| Auth | Better Auth (magic links) | Passwordless sign-in via email link |
| Email | Resend | Sends the magic link emails |
| Deployment | Vercel (Fluid Compute) | Hosts the Next.js app; long-running AI requests need Fluid Compute enabled |

---

## How the AI Works — Step by Step

### 1. Document Indexing (happens once per source)

When a student uploads a PDF or pastes a YouTube URL:

1. **PDF** — the file is saved to disk on the server. **YouTube** — the system fetches the video transcript via an API call.
2. The raw text is sent to Google's **Gemini File Search Store API**, which chunks the document, embeds each chunk into a vector space, and stores it permanently in a searchable index.
3. The notebook's `fileSearchStoreName` is saved in the database. This is the pointer to the index — it never expires and never needs re-uploading.

This is semantically equivalent to what NotebookLM does when you add a source. The difference: we built it from scratch using the Gemini Files API.

---

### 2. Chat — The Request Pipeline

Every time a student sends a message, the `/api/chat` route runs this pipeline:

```
Browser sends message
  → /api/chat POST handler
      1. Authenticate (Better Auth session cookie)
      2. Load notebook + materials from DB
      3. Classify intent (Gemini call)
      4. Branch by intent → run the appropriate path
      5. Stream the response back to the browser
      6. Write interaction to DB
```

#### Intent Classification

Before doing anything else, the system asks Gemini: *"What is the student trying to do?"*

Four possible intents:
- `new_question` — asking something fresh
- `answer_attempt` — replying to the previous Quick check
- `give_up` — "idk", "show me the answer", "skip", etc.
- `meta` — asking about how the app itself works

Give-up phrases are caught by pattern matching first (regex, no AI call needed). Everything else is a `generateText` call to Gemini with a classification prompt.

---

### 3. Retrieval-Augmented Generation (RAG)

When the system needs to answer a question, it does **two concurrent Gemini calls** — started at the same time so neither waits for the other:

**Call A — Answer stream:**
Uses `streamText` from the Vercel AI SDK with `google.tools.fileSearch({ fileSearchStoreNames: [...] })` as a provider-defined tool. This single call tells Gemini to:
1. Search the File Search Store for relevant chunks
2. Use those chunks to write a structured answer
3. Stream the text back token by token

The streaming happens via the AI SDK's `createUIMessageStream`, which pipes the token stream directly to the browser over HTTP. The student sees words appear in real time.

**Call B — Source excerpts:**
A smaller `generateText` call (not streaming) with a focused retrieval prompt: *"Find 1–3 relevant passages and return them as JSON."* This gives us the actual quoted text from the source documents to display in the Sources accordion.

Both calls search the same File Search Store. Call A streams while Call B runs in parallel, so the total time added by retrieval is roughly zero.

---

### 4. The Vercel AI SDK — What It Actually Does

The AI SDK (`ai` package) is the glue between our Next.js server and the Gemini API. Key functions used:

| Function | Where | What it does |
|---|---|---|
| `streamText` | `/api/chat` | Calls Gemini and returns a streaming result object |
| `generateText` | `/api/chat` | Calls Gemini and returns a plain text string (no streaming) |
| `createUIMessageStream` | `/api/chat` | Wraps multiple stream operations into one HTTP response |
| `createUIMessageStreamResponse` | `/api/chat` | Converts the stream into an HTTP Response object |
| `useChat` | `ChatThread.tsx` | React hook — manages message state and sends requests to `/api/chat` |
| `DefaultChatTransport` | `ChatThread.tsx` | Handles the HTTP connection from the browser side |

**Custom data parts:** The AI SDK lets you attach typed data payloads to assistant messages alongside the text stream. We use this to send mastery scores, topic names, source files, and interaction IDs to the browser without a separate API call. They arrive in the same stream as the text and are parsed on the client by reading `message.parts`.

---

### 5. The Database Schema

Five tables:

```
user          → students and admins (role column differentiates)
session       → active sessions (managed by Better Auth)
notebooks     → one per subject; holds the pointer to the File Search Store
materials     → PDFs and YouTube videos; status: pending → ready | failed
topics        → one row per (user, notebook, topic name); holds the mastery score
interactions  → one row per AI response; stores the question, answer, student reply,
                correctness label, score change, and retrieved source excerpts (as JSON)
```

All foreign keys use `ON DELETE CASCADE` — deleting a notebook automatically deletes all its materials, topics, and interactions.

The **mastery score** lives on the `topics` table. It is updated in place every time a Quick check is scored. The full history of score changes is reconstructable from the `interactions` table (each row stores the delta).

---

### 6. Streaming to the Browser

This is worth explaining clearly because it's non-obvious.

**Server side:**
- `streamText` returns a result object with a `.toUIMessageStream()` method
- `createUIMessageStream` merges that stream with custom data parts (scores, topics, sources)
- `createUIMessageStreamResponse` converts the merged stream into a standard HTTP Response using chunked transfer encoding

**Browser side:**
- `useChat` (from `@ai-sdk/react`) receives the chunked HTTP response and unpacks it
- Text chunks are appended to the message in real time — this is what makes words appear progressively
- Data parts (scores, topics, sources) are parsed from the stream and stored in `message.parts`
- The `onData` callback fires each time a data part arrives — we use this to update the active `interactionId` so the next message knows which Quick check it's answering

**Why this approach:**
Standard `fetch` + `JSON.parse` would require waiting for the full response before showing anything. Streaming lets the student start reading the answer while it's still being generated — reducing perceived latency from ~3–5s to effectively instant.

---

### 7. Authentication — Magic Links

No passwords anywhere in the system.

1. Student enters their email on the landing page
2. Better Auth generates a time-limited token and Resend delivers it as an email link
3. Student clicks the link → Better Auth validates the token → sets an `HttpOnly` session cookie
4. Every subsequent request includes the cookie automatically — the server validates it via `auth.api.getSession()`

The `HttpOnly` flag means JavaScript cannot read the cookie — only the browser sends it. This prevents XSS attacks from stealing session tokens.

Admins use the same magic link flow. Role is a column on the `user` table; `admin` routes check `session.user.role === "admin"` server-side.

---

### 8. The Mastery Algorithm

Pure functions with no side effects, defined in `src/lib/mastery.ts`:

```
scoreDelta(correctness):
  "correct"            → +15
  "correct_with_hint"  → +5
  "incorrect"          → −10
  "give_up"            → −5

clipScore(score):
  clamp to [0, 100]

getMasteryTier(score):
  0–30   → "recall"
  31–60  → "application"
  61–100 → "analysis"
```

The tier is passed into every answer prompt. The Gemini model uses it to calibrate difficulty: recall = define and identify, application = use and apply, analysis = compare, evaluate, reason.

Scoring happens in the `/api/chat` route immediately after correctness classification — the DB update and the next answer stream run concurrently so the score is persisted before the response finishes.

---

### 9. How a Full Interaction Flows (end to end)

```
Student: "what is a binary search tree?"

1. /api/chat receives the POST
2. Authenticates the session cookie
3. Loads the notebook and its File Search Store name from the DB
4. Classifies intent → new_question
5. Parallel:
   a. generateText: classify topic → "binary search trees"
6. getOrCreateTopic("binary search trees") in DB
7. Parallel:
   a. streamText: Gemini searches the store, writes the answer, streams it
   b. generateText: retrieve 1–3 quoted passages from the store as JSON
8. writer.merge() pipes the stream to the browser → student sees words appear
9. await result.text + await retrievalPromise → both finish
10. createInteraction() writes to DB:
    - question, response, topic_id, retrieved excerpts (JSON), template used
11. touchNotebook() updates the notebook's updatedAt timestamp
12. writer.write() sends data parts: topic name, mastery score, source items, interaction ID

Browser:
13. useChat() assembles the message parts and re-renders
14. AssistantTurn parses: text → displays with markdown, data-topic → badge,
    data-sources → Sources accordion, data-interaction → sets interactionId for next reply
```

---

### 10. Key Design Decisions (for examiners)

**Why File Search Stores instead of a self-hosted vector DB?**
Gemini File Search Stores handle chunking, embedding, and retrieval in one API call with no infrastructure to manage. A self-hosted solution (Pinecone, pgvector) would give more control but adds significant operational complexity for no thesis-specific benefit.

**Why not just use the Gemini Files API?**
The Files API has a 48-hour expiry. Students upload once and expect their sources to work indefinitely. File Search Stores are permanent.

**Why stream instead of await the full response?**
Gemini 2.5 Flash takes 2–5 seconds to generate a full answer. Streaming starts showing text within ~500ms. The UX difference is substantial — streaming feels instant; awaiting the full response feels broken.

**Why Drizzle ORM instead of Prisma or raw SQL?**
Drizzle generates TypeScript types directly from the schema definition. Every query is type-safe at compile time. It is also significantly lighter than Prisma and has native support for Neon's serverless driver.

**Why Better Auth with magic links instead of OAuth?**
The cohort is a fixed set of university students. Requiring a Google/GitHub account would exclude students who don't have one set up. Magic links work with any university email address.
