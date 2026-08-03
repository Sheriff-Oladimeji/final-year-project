# How LearnAI Works

A plain-English breakdown of the whole system — what it does, how it thinks, and how every part connects. No code knowledge needed.

---

## The Big Idea

LearnAI is like a personal tutor that lives inside your uploaded notes. You create a **notebook**, upload your lecture PDFs or YouTube videos as **sources**, and then chat with the AI — which only ever answers from your actual materials, not from general internet knowledge.

The twist that makes it different from ChatGPT or NotebookLM: **after every answer, the AI asks you a question back.** Your reply gets scored, and the system tracks how well you understand each topic over time. The AI adapts its style based on how well you're doing.

---

## The Three Pillars

### 1. Notebooks and Sources

A **notebook** is a container — think of it like a Google Drive folder for a single subject (e.g. "DSA", "Operating Systems").

Each notebook can hold **up to 10 sources**:
- PDF documents (uploaded directly)
- YouTube videos (paste the URL — the system fetches the transcript automatically)

When you add a source, the system sends it to Google's servers where it gets broken into chunks and stored in a **searchable index** (called a File Search Store). This is what lets the AI search your materials later. It's permanent — no expiry, no re-uploading.

---

### 2. The Mastery Score

Every topic you discuss gets its own **mastery score** from 0 to 100. Each score belongs to one notebook — so "binary trees" in your DSA notebook and "binary trees" in your Algorithms notebook are tracked separately.

The score changes based on how you answer the Quick check after each AI response:

| What you did | Score change |
|---|---|
| Answered correctly | **+15** |
| Answered mostly right (needed a nudge) | **+5** |
| Answered incorrectly | **−10** |
| Gave up / said "I don't know" | **−5** |

The score is clamped between 0 and 100 — it can never go negative or above 100.

#### The Three Tiers

The score determines which **tier** you're in for that topic. The tier doesn't change how the AI scores you — it changes how the AI *talks* to you:

| Tier | Score range | What it means |
|---|---|---|
| **Recall** | 0–30 | You're still learning the basics. AI focuses on definitions and core ideas. |
| **Application** | 31–60 | You understand the basics. AI asks you to use or apply the concept. |
| **Analysis** | 61–100 | You've got it. AI asks you to compare, evaluate, and reason. |

So the AI gets progressively harder with you as you improve — automatically.

---

### 3. The Conversation Loop

Every chat message goes through a pipeline. Here's exactly what happens each time you send something:

#### Step 1 — What did you mean?

The system first figures out the **intent** of your message. There are four possibilities:

- **New question** — you're asking something fresh about the material
- **Answer attempt** — you're replying to the Quick check the AI just asked
- **Give up** — you typed something like "idk", "show me the answer", "skip", "I give up"
- **Meta** — you're asking about how the app itself works

It uses pattern matching for give-up phrases first (fast, no AI needed). For everything else, it asks Gemini to classify it.

#### Step 2 — What happens depends on the intent

**If it's a new question:**
1. The AI classifies which topic your question belongs to (e.g. "binary search trees") — this is what shows up as the blue badge in the chat
2. It searches your notebook's sources for relevant content using semantic search
3. It writes a structured answer: plain-English opening → real-world analogy → numbered examples → (if comparing things) a table
4. It ends with a **Quick check** question — something specific to what it just explained

**If it's an answer attempt:**
1. The AI compares your reply to what it said in the previous response and scores it (correct / correct with hint / incorrect)
2. Your mastery score updates immediately
3. The AI either moves you forward (if correct) or re-explains from a different angle (if incorrect), then asks a new Quick check

**If it's a give up:**
1. Your score drops by 5
2. The AI reveals the answer directly — 2 to 4 sentences
3. It then asks a slightly easier follow-up Quick check to keep you going

**If it's a meta question (about the app):**
The AI explains how the app works briefly, then encourages you to ask about your materials.

#### Step 3 — Suggestions

After every response, the system generates **3 short follow-up options** as clickable chips below the message. These are tailored to what was just discussed:
- If the AI ended with a Quick check, one of the three is always a give-up option ("I don't know", "show me the answer")
- If your mastery score is high (70+), one option suggests moving to the next concept

---

## The AI's Response Style

The AI is instructed to write like a great teacher explaining to a smart friend — not like a textbook. Every response follows the same shape:

1. **Opening** — one plain sentence, zero jargon. "A queue is a way of waiting in line."
2. **Analogy** — "Think of it like this: imagine a bank queue where the first person to arrive is the first to be served."
3. **Structure** — numbered headings if the question covers multiple sub-concepts
4. **Examples** — step-by-step numbered list when explaining a process
5. **Tables** — used when comparing two or more things side by side
6. **Quick check** — always ends with one question to test understanding

It never says "Great question!" or "According to the source material." It answers in direct, conversational prose.

---

## What Gets Stored

Every interaction is saved to the database. Here's what the system keeps:

| Thing | What's stored |
|---|---|
| **Notebooks** | Title, creation date, link to the File Search Store |
| **Materials** | File name or YouTube URL, processing status (pending / ready / failed), when it was indexed |
| **Topics** | Name (e.g. "merge sort"), current mastery score, which notebook it belongs to |
| **Interactions** | The student's question, the AI's full response, the student's reply to the Quick check, the correctness score, the score change |

History is permanent — closing the browser and coming back still shows the full conversation and current mastery scores.

---

## How the AI Reads Your Sources

When you ask a question, the AI doesn't read your entire PDF every time. Instead it uses **semantic search** — similar to how Google finds relevant results without needing exact keywords.

Your sources were broken into chunks when you uploaded them. The AI's question gets turned into a search query, the search finds the most relevant chunks, and those chunks are what the AI uses to write its answer. This is why the AI can answer cross-source questions ("compare what the lecture video says about X vs the PDF") — it searches across all sources in the notebook at once.

This is also why answers are grounded: the AI is literally reading from your notes, not inventing things.

---

## The Admin Side

Admins can see all users and all interactions in the system. They can disable accounts. The admin view exists so the thesis supervisor can audit how the system is being used during the study.

---

## Explaining the Mastery Algorithm to Someone

If someone asks "how does the scoring work?" — here's the simple version:

> Each topic starts at zero. Every time the AI asks you a Quick check and you get it right, you gain 15 points. A partially right answer gives 5 points. Wrong costs 10, and giving up costs 5. The score never goes below 0 or above 100. Once you pass 30 you're in the Application tier — the questions get harder. Past 60 you're in Analysis — the AI starts asking you to reason and compare, not just recall facts. It's the same idea as how a good teacher gets harder as you improve.

---

## Summary Flow

```
You upload a PDF or YouTube link
    → System indexes it into a searchable store (permanent)

You ask a question in chat
    → System classifies: new question / answer attempt / give up / meta
    → For new questions: searches your sources → writes structured answer → ends with Quick check
    → For answer attempts: scores your reply → updates mastery → moves forward or re-explains
    → For give up: reveals answer → drops score 5 pts → asks easier follow-up

Mastery score updates per topic
    → 0–30: Recall tier (basics)
    → 31–60: Application tier (use it)
    → 61–100: Analysis tier (reason about it)

Everything is saved → close and reopen → exactly where you left off
```
