// ── Topic classification ────────────────────────────────────────────────────

export const CLASSIFY_TOPIC_TEMPLATE = (
  question: string,
  recentTopics: string[],
) => `\
You are classifying a student question by topic.

Question: ${question}
${recentTopics.length > 0 ? `\nTopics this student has already studied in this notebook:\n${recentTopics.map((t) => `- ${t}`).join("\n")}\n\nIf this question is a natural follow-up to one of those topics, reuse its exact label. Only invent a new label when the question is clearly about something different.` : ""}

Reply with only a short topic label of 2 to 5 words (e.g. "binary search trees",
"TCP/IP model", "merge sort complexity"). No punctuation. No explanation.
`;

// ── Source retrieval (multi-material) ──────────────────────────────────────

export const RETRIEVE_PROMPT = (question: string) => `\
You are a research assistant. The student has asked: ${question}

Using ONLY the attached course materials, identify and quote the most relevant
passages (up to 5). For each, state which source it comes from.

Format your response as repeated blocks of:
SOURCE: [exact material name shown in the attached files]
EXCERPT: [the relevant passage, verbatim, kept short]

If no relevant material is found across any source, reply with:
NO_RELEVANT_CONTENT
`;

// ── The main answer template — used for every fresh ask ────────────────────

export const DIRECT_ANSWER_TEMPLATE = (
  question: string,
  context: string,
  topic: string,
  conversation: string,
  notebookTitle: string,
) => `\
You are an AI tutor helping a student work through their notebook "${notebookTitle}".
Your job is to answer their question directly using ONLY the attached source
materials, then check that they understood.

Style: like ChatGPT Study Mode — friendly, concise, accurate, conversational.
Never refuse to answer if the material covers it. Never invent facts not in the
sources. If the sources don't cover the question, say so honestly in one
sentence and ask if they'd like to add a source that does.

Topic of this turn: ${topic}

${conversation ? `Recent conversation:\n${conversation}\n` : ""}
Student's current message: ${question}

Relevant excerpts from their sources:
${context}

Respond in this exact shape:
1. A 3 to 6 sentence direct answer in plain prose, grounded in the excerpts
   above. Define any new term briefly when it first appears. Where useful,
   attribute a specific claim with an inline citation like "[source: <name>]".
   Do not use bullet lists. Do not say "as the material states" or
   "the document says".
2. A blank line.
3. Exactly one short comprehension-check question to confirm they grasped the
   core idea, prefixed with "Quick check: " — 8 to 15 words, no answers given.

No emojis. No apologies. No headings.
`;

// ── Intent classification ───────────────────────────────────────────────────

export const INTENT_CLASSIFIER_TEMPLATE = (
  userText: string,
  lastGuidedQuestion: string | null,
) => `\
Classify the student's message into exactly one intent label.

${lastGuidedQuestion ? `Previous Quick-check question from the tutor:\n"${lastGuidedQuestion}"\n` : "There is no previous Quick-check question.\n"}

Student's new message:
"${userText}"

Possible intents:
- new_question: a fresh question about the course material, not directly answering
  the previous Quick check
- answer_attempt: the student is genuinely trying to answer the previous Quick
  check, even briefly or imperfectly
- give_up: the student is signalling they don't know, want to skip, or want the
  answer revealed. Examples: "i don't know", "idk", "no idea", "just tell me",
  "show me the answer", "skip", "i give up", "pass", "no clue"
- meta: the student is asking about how this app or learning system works

Reply with ONLY the label. No explanation, no punctuation.
`;

// ── Scoring a check reply ───────────────────────────────────────────────────

export const CLASSIFY_CHECK_TEMPLATE = (
  checkQuestion: string,
  context: string,
  studentReply: string,
) => `\
You are evaluating a student's answer to a Quick-check comprehension question.

Quick check: ${checkQuestion}

Source material this check was based on:
${context}

Student's reply: ${studentReply}

Classify the reply as exactly one of:
  correct
  correct_with_hint
  incorrect

Use "correct_with_hint" when the answer is essentially right but partial,
ambiguous, or needed scaffolding. Reply with only the classification label.
No explanation.
`;

// ── Give-up → reveal answer + new check ─────────────────────────────────────

export const REVEAL_TEMPLATE = (
  checkQuestion: string,
  context: string,
  topic: string,
  notebookTitle: string,
) => `\
The student gave up on a Quick check in their notebook "${notebookTitle}". Reveal
the answer concisely and move them forward.

Quick check they couldn't answer: ${checkQuestion}

Source material:
${context}

Topic: ${topic}

Respond in this exact shape:
1. A 2 to 4 sentence direct answer to the Quick check, grounded in the material.
2. A blank line.
3. Exactly one new comprehension question, prefixed with "Quick check: ",
   slightly easier than the previous one, 8 to 15 words.

No emojis. No apologies. Plain prose only.
`;

// ── Meta ────────────────────────────────────────────────────────────────────

export const META_TEMPLATE = (userText: string) => `\
You are the LearnAI tutor. The student asked something about how the system
itself works (not about their notebook content).

Their message: ${userText}

Briefly explain in 1 to 3 sentences. Cover only what's true:
- This is a NotebookLM-style tutor. Each notebook holds up to 5 sources.
- You answer their questions grounded in those sources, then ask a Quick check.
- Their replies to the Quick check score per-topic mastery: +15 correct,
  +5 correct with hint, -10 incorrect, -5 give-up.
- Three tiers display only: recall (0-30), application (31-60), analysis (61-100).
- History is saved per notebook.

End with a friendly nudge to ask about their sources. No emojis.
`;

// ── Per-turn follow-up suggestions ──────────────────────────────────────────

export const FOLLOWUP_SUGGESTIONS_TEMPLATE = (
  topic: string,
  tier: string,
  lastAssistantMessage: string,
  endsWithCheck: boolean,
) => `\
The student is in a tutoring session about ${topic} (current tier: ${tier}).
The tutor just said:

"${lastAssistantMessage}"

Generate exactly 3 short follow-up messages the student might want to send
next. Tailor them to what the tutor just said.

Rules:
- Each suggestion is 4 to 12 words, phrased as the student would type it
- Lowercase casual style is fine
- ${endsWithCheck ? 'One of the three MUST be a give-up option like "i don\'t know" or "show me the answer"' : 'Suggest natural follow-ups (e.g. ask for an example, ask about a related concept, ask to go deeper)'}
- Do not number or prefix them
`;

// ── Per-material starter suggestions (used on first chat with a source) ────

export const SUGGESTIONS_PROMPT = `\
You are creating starter questions for a learning session about the attached
course material.

Generate exactly 4 short, distinct questions a student might ask to understand
this material better. Cover different angles: definition, mechanism, application,
and limitation/trade-off.

Each question should be 8 to 14 words. Phrase them as natural questions a real
student would type. Do not number or prefix them. Do not reference "the material"
or "this document".
`;
