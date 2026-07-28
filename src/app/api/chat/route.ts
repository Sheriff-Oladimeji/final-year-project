import { headers } from "next/headers";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  streamText,
} from "ai";
import { google } from "@ai-sdk/google";
import { auth } from "@/lib/auth";
import { geminiModel, NO_THINKING } from "@/lib/ai/model";
import { buildConversationContext } from "@/lib/ai/conversation";
import type { ChatMessage } from "@/lib/ai/chat-types";
import {
  CLASSIFY_TOPIC_TEMPLATE,
  DIRECT_ANSWER_TEMPLATE,
  AFTER_CORRECT_TEMPLATE,
  REVEAL_TEMPLATE,
  CLASSIFY_CHECK_TEMPLATE,
  INTENT_CLASSIFIER_TEMPLATE,
  META_TEMPLATE,
} from "@/lib/gemini/prompts";
import { getNotebook, touchNotebook } from "@/db/queries/notebooks";
import { listReadyMaterialsInNotebook } from "@/db/queries/materials";
import {
  getOrCreateTopic,
  updateMasteryScore,
  listNotebookTopicNames,
} from "@/db/queries/topics";
import {
  createInteraction,
  updateInteraction,
  getInteraction,
  listInteractionsByNotebook,
} from "@/db/queries/interactions";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getMasteryTier, scoreDelta, clipScore } from "@/lib/mastery";
import type { Correctness } from "@/types";

export const maxDuration = 60;

type Intent = "new_question" | "answer_attempt" | "give_up" | "meta";

interface ChatRequestBody {
  messages: ChatMessage[];
  notebookId: string;
  interactionId?: string;
}

function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const text = m.parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join(" ")
      .trim();
    if (text) return text;
  }
  return "";
}

async function classifyIntent(
  userText: string,
  lastGuidedQuestion: string | null,
): Promise<Intent> {
  const lowered = userText.toLowerCase().trim();
  const giveUpPatterns = [
    /^idk\.?$/,
    /^i\s*don'?t\s*know/,
    /^no\s*idea/,
    /^no\s*clue/,
    /^just\s*tell\s*me/,
    /^show\s*me\s*(the)?\s*answer/,
    /^skip$/,
    /^pass$/,
    /^i\s*give\s*up/,
  ];
  if (giveUpPatterns.some((re) => re.test(lowered))) return "give_up";

  try {
    const { text } = await generateText({
      model: geminiModel,
      prompt: INTENT_CLASSIFIER_TEMPLATE(userText, lastGuidedQuestion),
      providerOptions: NO_THINKING,
    });
    const label = text.trim().toLowerCase().split(/\s/)[0] ?? "";
    if (["new_question", "answer_attempt", "give_up", "meta"].includes(label)) {
      return label as Intent;
    }
  } catch {
    // fall through
  }
  return lastGuidedQuestion ? "answer_attempt" : "new_question";
}

/**
 * Explicitly retrieve 1–3 relevant passages from the file search store for a
 * given question. Runs concurrently with the main answer stream so it adds no
 * visible latency. Falls back to bare material names if anything fails.
 */
async function retrieveSourceExcerpts(
  question: string,
  fileSearchStoreName: string,
  fallbackNames: string[],
): Promise<Array<{ name: string; excerpt?: string }>> {
  try {
    const { text } = await generateText({
      model: geminiModel,
      providerOptions: NO_THINKING,
      tools: { file_search: google.tools.fileSearch({ fileSearchStoreNames: [fileSearchStoreName] }) },
      prompt: `\
Find 1 to 3 short passages from the course materials most relevant to:
"${question}"

Output ONLY a JSON array — no other text:
[{"name":"exact document title","excerpt":"verbatim passage, max 2 sentences"}]

Quote the source text directly. If nothing relevant is found, output: []`,
    });
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Array<{ name?: string; excerpt?: string }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((item) => item.name)
          .map(({ name, excerpt }) => ({ name: name!, excerpt: excerpt ?? undefined }));
      }
    }
  } catch {
    // fall through to fallback
  }
  return fallbackNames.map((name) => ({ name }));
}

function parseCorrectness(raw: string): Correctness {
  const label = raw.trim().toLowerCase().split(/\s/)[0] ?? "incorrect";
  return (["correct", "correct_with_hint", "incorrect"].includes(label)
    ? label
    : "incorrect") as Correctness;
}


export async function POST(req: Request) {
  const requestStartedAt = Date.now();
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  let body: ChatRequestBody;
  let userText: string;
  let userId: string;
  let sessionId: string;
  let notebookId: string;
  let interactionId: string | undefined;
  let notebookTitle: string;
  let fileSearchStoreName: string;
  let materialNames: string[] = [];
  let priorInteraction: Awaited<ReturnType<typeof getInteraction>> | null;
  let intent: Intent;
  let conversation = "";

  try {
    session = await auth.api.getSession({ headers: await headers() });
    if (!session || session.user.banned) {
      return new Response("Unauthorised", { status: 401 });
    }

    body = (await req.json()) as ChatRequestBody;
    notebookId = body.notebookId;
    interactionId = body.interactionId;

    if (!notebookId) return new Response("Missing notebookId", { status: 400 });
    userText = lastUserText(body.messages);
    if (!userText) return new Response("Empty message", { status: 400 });

    userId = session.user.id;
    sessionId = session.session.id;

    const [notebook, materials, priorInteractionRaw, recentInteractions] = await Promise.all([
      getNotebook(notebookId, userId),
      listReadyMaterialsInNotebook(userId, notebookId),
      interactionId ? getInteraction(interactionId, userId) : Promise.resolve(null),
      listInteractionsByNotebook(userId, notebookId, 12),
    ]);

    if (!notebook) return new Response("Notebook not found", { status: 404 });
    if (!notebook.fileSearchStoreName) {
      return new Response("Notebook file store is not ready yet.", { status: 400 });
    }
    if (materials.length === 0) {
      return new Response(
        "This notebook has no ready sources yet. Add at least one PDF or YouTube link first.",
        { status: 400 },
      );
    }

    notebookTitle = notebook.title;
    fileSearchStoreName = notebook.fileSearchStoreName;
    materialNames = materials.map((m) => m.displayName);
    priorInteraction = priorInteractionRaw;
    conversation = buildConversationContext(recentInteractions, 6);
    const lastGuidedQuestion = priorInteraction?.response ?? null;

    intent = await classifyIntent(userText, lastGuidedQuestion);

    if (
      intent === "answer_attempt" &&
      priorInteraction &&
      priorInteraction.correctness !== "unscored"
    ) {
      intent = "new_question";
      priorInteraction = null;
    }
  } catch (err) {
    console.error("[/api/chat] preflight error", err);
    const message = err instanceof Error ? `${err.name}: ${err.message}` : "Server error";
    return new Response(message, { status: 500 });
  }

  const fsTools = { file_search: google.tools.fileSearch({ fileSearchStoreNames: [fileSearchStoreName] }) };

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      // ── META ─────────────────────────────────────────────────────────────
      if (intent === "meta") {
        const result = streamText({ model: geminiModel, prompt: META_TEMPLATE(userText) });
        writer.merge(result.toUIMessageStream());
        writer.write({ type: "data-mode", id: "mode", data: { value: "meta" } });
        return;
      }

      // ── GIVE_UP: reveal the check's answer, score -5, ask a new check ────
      if (intent === "give_up" && priorInteraction) {
        const interaction = priorInteraction;
        const topicRows = await db.select().from(topics).where(eq(topics.id, interaction.topicId));
        const topic = topicRows[0];
        const newScore = clipScore(topic.masteryScore + scoreDelta("give_up"));
        const newTier = getMasteryTier(newScore);

        await Promise.all([
          updateMasteryScore(interaction.topicId, newScore),
          updateInteraction(interaction.id, userId, {
            studentReply: userText,
            correctness: "give_up" as unknown as Correctness,
            scoreDelta: scoreDelta("give_up"),
          }),
        ]);

        const result = streamText({
          model: geminiModel,
          prompt: REVEAL_TEMPLATE(interaction.response, topic.name, notebookTitle),
          tools: fsTools,
        });
        // Retrieval runs concurrently with the answer stream — no added latency.
        const retrievalPromise = retrieveSourceExcerpts(interaction.question, fileSearchStoreName, materialNames);
        writer.merge(result.toUIMessageStream({ sendSources: true }));
        const [text, sourceItems] = await Promise.all([result.text, retrievalPromise]);

        const next = await createInteraction({
          userId, sessionId, notebookId, topicId: topic.id,
          question: interaction.question,
          retrievedContext: JSON.stringify(sourceItems),
          promptTemplate: "reveal", response: text,
          latencyMs: Date.now() - requestStartedAt,
        });
        await touchNotebook(notebookId, userId);

        writer.write({ type: "data-mode", id: "mode", data: { value: "answer" } });
        writer.write({ type: "data-topic", id: "topic", data: { name: topic.name, mastery_score: newScore, tier: newTier } });
        writer.write({ type: "data-score", id: "score", data: { correctness: "give_up", score_delta: scoreDelta("give_up"), new_score: newScore, new_tier: newTier } });
        writer.write({ type: "data-sources", id: "sources", data: { items: sourceItems } });
        writer.write({ type: "data-interaction", id: "interaction", data: { id: next.id } });
        return;
      }

      // ── ANSWER_ATTEMPT: score the check, then next answer + new check ────
      if (intent === "answer_attempt" && priorInteraction) {
        const interaction = priorInteraction;

        const correctnessRaw = await generateText({
          model: geminiModel,
          prompt: CLASSIFY_CHECK_TEMPLATE(interaction.response, userText),
          providerOptions: NO_THINKING,
        });
        const correctness = parseCorrectness(correctnessRaw.text);
        const delta = scoreDelta(correctness);

        const topicRows = await db.select().from(topics).where(eq(topics.id, interaction.topicId));
        const topic = topicRows[0];
        const newScore = clipScore(topic.masteryScore + delta);
        const newTier = getMasteryTier(newScore);

        await Promise.all([
          updateMasteryScore(interaction.topicId, newScore),
          updateInteraction(interaction.id, userId, { studentReply: userText, correctness, scoreDelta: delta }),
        ]);

        const isCorrect = correctness === "correct" || correctness === "correct_with_hint";
        const prompt = isCorrect
          ? AFTER_CORRECT_TEMPLATE(
              interaction.question, userText, topic.name,
              conversation, notebookTitle, newTier, newScore, correctness === "correct_with_hint",
            )
          : DIRECT_ANSWER_TEMPLATE(
              interaction.question, topic.name, conversation, notebookTitle, newTier,
            );

        const result = streamText({
          model: geminiModel,
          prompt,
          tools: fsTools,
        });
        const retrievalPromise = retrieveSourceExcerpts(interaction.question, fileSearchStoreName, materialNames);
        writer.merge(result.toUIMessageStream({ sendSources: true }));
        const [text, sourceItems] = await Promise.all([result.text, retrievalPromise]);

        const next = await createInteraction({
          userId, sessionId, notebookId, topicId: topic.id,
          question: interaction.question,
          retrievedContext: JSON.stringify(sourceItems),
          promptTemplate: isCorrect ? "progress" : "answer", response: text,
          latencyMs: Date.now() - requestStartedAt,
        });
        await touchNotebook(notebookId, userId);

        writer.write({ type: "data-mode", id: "mode", data: { value: "guide" } });
        writer.write({ type: "data-topic", id: "topic", data: { name: topic.name, mastery_score: newScore, tier: newTier } });
        writer.write({ type: "data-score", id: "score", data: { correctness, score_delta: delta, new_score: newScore, new_tier: newTier } });
        writer.write({ type: "data-sources", id: "sources", data: { items: sourceItems } });
        writer.write({ type: "data-interaction", id: "interaction", data: { id: next.id } });
        return;
      }

      // ── NEW_QUESTION (or give_up with no prior interaction) ─────────────
      const recentTopics = await listNotebookTopicNames(userId, notebookId);

      const topicGen = await generateText({
        model: geminiModel,
        prompt: CLASSIFY_TOPIC_TEMPLATE(userText, recentTopics),
        providerOptions: NO_THINKING,
      });

      let topicLabel = topicGen.text.toLowerCase().trim().replace(/\.$/, "");
      if (topicLabel.length > 100) topicLabel = topicLabel.slice(0, 100);

      const topic = await getOrCreateTopic(userId, notebookId, topicLabel);
      const tier = getMasteryTier(topic.masteryScore);

      const result = streamText({
        model: geminiModel,
        prompt: DIRECT_ANSWER_TEMPLATE(userText, topicLabel, conversation, notebookTitle, tier),
        tools: fsTools,
      });
      const retrievalPromise = retrieveSourceExcerpts(userText, fileSearchStoreName, materialNames);
      writer.merge(result.toUIMessageStream({ sendSources: true }));
      const [text, sourceItems] = await Promise.all([result.text, retrievalPromise]);

      const interaction = await createInteraction({
        userId, sessionId, notebookId, topicId: topic.id,
        question: userText,
        retrievedContext: JSON.stringify(sourceItems),
        promptTemplate: "answer", response: text,
        latencyMs: Date.now() - requestStartedAt,
      });
      await touchNotebook(notebookId, userId);

      writer.write({ type: "data-mode", id: "mode", data: { value: "guide" } });
      writer.write({ type: "data-topic", id: "topic", data: { name: topicLabel, mastery_score: topic.masteryScore, tier } });
      writer.write({ type: "data-sources", id: "sources", data: { items: sourceItems } });
      writer.write({ type: "data-interaction", id: "interaction", data: { id: interaction.id } });
    },
    onError: (error) => {
      console.error("[/api/chat] error", error);
      return error instanceof Error
        ? error.message
        : "Something went wrong while processing your question.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
