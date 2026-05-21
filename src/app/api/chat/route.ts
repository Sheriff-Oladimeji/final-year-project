import { headers } from "next/headers";
import { z } from "zod";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateObject,
  generateText,
  streamText,
} from "ai";
import { auth } from "@/lib/auth";
import { geminiModel, NO_THINKING } from "@/lib/ai/model";
import { buildFileContentParts } from "@/lib/ai/file-parts";
import { buildConversationContext } from "@/lib/ai/conversation";
import type { ChatMessage } from "@/lib/ai/chat-types";
import {
  CLASSIFY_TOPIC_TEMPLATE,
  RETRIEVE_PROMPT,
  DIRECT_ANSWER_TEMPLATE,
  REVEAL_TEMPLATE,
  CLASSIFY_CHECK_TEMPLATE,
  INTENT_CLASSIFIER_TEMPLATE,
  META_TEMPLATE,
  FOLLOWUP_SUGGESTIONS_TEMPLATE,
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
import type { Citation, Correctness } from "@/types";

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

function parseCorrectness(raw: string): Correctness {
  const label = raw.trim().toLowerCase().split(/\s/)[0] ?? "incorrect";
  return (["correct", "correct_with_hint", "incorrect"].includes(label)
    ? label
    : "incorrect") as Correctness;
}

function parseRetrieved(raw: string): { contextText: string; citations: Citation[] } {
  if (raw.includes("NO_RELEVANT_CONTENT")) {
    return { contextText: "No directly relevant material found.", citations: [] };
  }
  const citations: Citation[] = [];
  const contextParts: string[] = [];
  let currentSource = "";
  let currentExcerptLines: string[] = [];

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("SOURCE:")) {
      if (currentSource && currentExcerptLines.length > 0) {
        const excerpt = currentExcerptLines.join(" ").trim();
        citations.push({ source: currentSource, excerpt });
        contextParts.push(`[${currentSource}] ${excerpt}`);
        currentExcerptLines = [];
      }
      currentSource = line.slice("SOURCE:".length).trim();
    } else if (line.startsWith("EXCERPT:")) {
      currentExcerptLines = [line.slice("EXCERPT:".length).trim()];
    } else if (line && currentExcerptLines.length > 0) {
      currentExcerptLines.push(line);
    }
  }

  if (currentSource && currentExcerptLines.length > 0) {
    const excerpt = currentExcerptLines.join(" ").trim();
    citations.push({ source: currentSource, excerpt });
    contextParts.push(`[${currentSource}] ${excerpt}`);
  }

  if (citations.length === 0) {
    return {
      contextText: raw,
      citations: [{ source: "course material", excerpt: raw.slice(0, 500) }],
    };
  }
  return { contextText: contextParts.join("\n\n"), citations };
}

const SuggestionsSchema = z.object({ suggestions: z.array(z.string()).min(1).max(5) });

const DEFAULT_CHECK_SUGGESTIONS = ["i don't know", "show me the answer", "give me a hint"];
const DEFAULT_FREE_SUGGESTIONS = ["tell me more", "give me an example", "how does this apply?"];

async function generateFollowups(
  topic: string,
  tier: string,
  lastAssistant: string,
  endsWithCheck: boolean,
): Promise<string[]> {
  try {
    const { object } = await generateObject({
      model: geminiModel,
      schema: SuggestionsSchema,
      prompt: FOLLOWUP_SUGGESTIONS_TEMPLATE(topic, tier, lastAssistant, endsWithCheck),
      providerOptions: NO_THINKING,
    });
    if (object.suggestions.length > 0) return object.suggestions;
  } catch {
    // fall through to defaults
  }
  return endsWithCheck ? DEFAULT_CHECK_SUGGESTIONS : DEFAULT_FREE_SUGGESTIONS;
}

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  let body: ChatRequestBody;
  let userText: string;
  let userId: string;
  let sessionId: string;
  let notebookId: string;
  let interactionId: string | undefined;
  let notebookTitle: string;
  let fileParts: Awaited<ReturnType<typeof buildFileContentParts>>;
  let priorInteraction: Awaited<ReturnType<typeof getInteraction>> | null;
  let intent: Intent;
  let conversation = "";

  try {
    session = await auth.api.getSession({ headers: await headers() });
    if (!session || session.user.disabledAt) {
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

    // Run all independent DB queries in parallel
    const [notebook, materials, priorInteractionRaw, recentInteractions] = await Promise.all([
      getNotebook(notebookId, userId),
      listReadyMaterialsInNotebook(userId, notebookId),
      interactionId ? getInteraction(interactionId, userId) : Promise.resolve(null),
      listInteractionsByNotebook(userId, notebookId, 12),
    ]);

    if (!notebook) return new Response("Notebook not found", { status: 404 });
    if (materials.length === 0) {
      return new Response(
        "This notebook has no ready sources yet. Add at least one PDF or YouTube link first.",
        { status: 400 },
      );
    }

    notebookTitle = notebook.title;
    priorInteraction = priorInteractionRaw;
    conversation = buildConversationContext(recentInteractions, 6);
    const lastGuidedQuestion = priorInteraction?.response ?? null;

    // File prep and intent classification are independent — run in parallel
    [fileParts, intent] = await Promise.all([
      buildFileContentParts(materials),
      classifyIntent(userText, lastGuidedQuestion),
    ]);

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

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      // ── META ─────────────────────────────────────────────────────────────
      if (intent === "meta") {
        const result = streamText({ model: geminiModel, prompt: META_TEMPLATE(userText) });
        writer.merge(result.toUIMessageStream());
        const text = await result.text;
        const followups = await generateFollowups("the LearnAI app", "meta", text, false);
        writer.write({ type: "data-mode", id: "mode", data: { value: "meta" } });
        writer.write({ type: "data-suggestions", id: "sugs", data: { items: followups } });
        return;
      }

      // ── GIVE_UP: reveal the check's answer, score -5, ask a new check ────
      if (intent === "give_up" && priorInteraction) {
        const interaction = priorInteraction;
        const contextText = interaction.retrievedContext ?? "";
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

        const prompt = REVEAL_TEMPLATE(interaction.response, contextText, topic.name, notebookTitle);
        const result = streamText({
          model: geminiModel,
          messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...fileParts] }],
        });
        writer.merge(result.toUIMessageStream());
        const text = await result.text;

        const [next, followups] = await Promise.all([
          createInteraction({
            userId, sessionId, notebookId, topicId: topic.id,
            question: interaction.question, retrievedContext: contextText,
            promptTemplate: "reveal", response: text,
          }),
          generateFollowups(topic.name, newTier, text, true),
        ]);
        await touchNotebook(notebookId, userId);

        writer.write({ type: "data-mode", id: "mode", data: { value: "answer" } });
        writer.write({ type: "data-topic", id: "topic", data: { name: topic.name, mastery_score: newScore, tier: newTier } });
        writer.write({ type: "data-score", id: "score", data: { correctness: "give_up", score_delta: scoreDelta("give_up"), new_score: newScore, new_tier: newTier } });
        writer.write({ type: "data-interaction", id: "interaction", data: { id: next.id } });
        writer.write({ type: "data-suggestions", id: "sugs", data: { items: followups } });
        return;
      }

      // ── ANSWER_ATTEMPT: score the check, then next answer + new check ────
      if (intent === "answer_attempt" && priorInteraction) {
        const interaction = priorInteraction;
        const contextText = interaction.retrievedContext ?? "";

        const correctnessRaw = await generateText({
          model: geminiModel,
          prompt: CLASSIFY_CHECK_TEMPLATE(interaction.response, contextText, userText),
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

        const prompt = DIRECT_ANSWER_TEMPLATE(
          interaction.question, contextText, topic.name, conversation, notebookTitle, newTier,
        );
        const result = streamText({
          model: geminiModel,
          messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...fileParts] }],
        });
        writer.merge(result.toUIMessageStream());
        const text = await result.text;

        const [next, followups] = await Promise.all([
          createInteraction({
            userId, sessionId, notebookId, topicId: topic.id,
            question: interaction.question, retrievedContext: contextText,
            promptTemplate: "answer", response: text,
          }),
          generateFollowups(topic.name, newTier, text, true),
        ]);
        await touchNotebook(notebookId, userId);

        writer.write({ type: "data-mode", id: "mode", data: { value: "guide" } });
        writer.write({ type: "data-topic", id: "topic", data: { name: topic.name, mastery_score: newScore, tier: newTier } });
        writer.write({ type: "data-score", id: "score", data: { correctness, score_delta: delta, new_score: newScore, new_tier: newTier } });
        writer.write({ type: "data-interaction", id: "interaction", data: { id: next.id } });
        writer.write({ type: "data-suggestions", id: "sugs", data: { items: followups } });
        return;
      }

      // ── NEW_QUESTION (or give_up with no prior interaction) ─────────────
      const recentTopics = await listNotebookTopicNames(userId, notebookId);
      const [topicGen, retrievedGen] = await Promise.all([
        generateText({
          model: geminiModel,
          messages: [{ role: "user", content: [{ type: "text", text: CLASSIFY_TOPIC_TEMPLATE(userText, recentTopics) }, ...fileParts] }],
          providerOptions: NO_THINKING,
        }),
        generateText({
          model: geminiModel,
          messages: [{ role: "user", content: [{ type: "text", text: RETRIEVE_PROMPT(userText) }, ...fileParts] }],
          providerOptions: NO_THINKING,
        }),
      ]);

      let topicLabel = topicGen.text.toLowerCase().trim().replace(/\.$/, "");
      if (topicLabel.length > 100) topicLabel = topicLabel.slice(0, 100);

      const { contextText, citations } = parseRetrieved(retrievedGen.text);
      const topic = await getOrCreateTopic(userId, notebookId, topicLabel);
      const tier = getMasteryTier(topic.masteryScore);

      const prompt = DIRECT_ANSWER_TEMPLATE(
        userText, contextText, topicLabel, conversation, notebookTitle, tier,
      );
      const result = streamText({
        model: geminiModel,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...fileParts] }],
      });
      writer.merge(result.toUIMessageStream());
      const text = await result.text;

      const [interaction, followups] = await Promise.all([
        createInteraction({
          userId, sessionId, notebookId, topicId: topic.id,
          question: userText, retrievedContext: contextText,
          promptTemplate: "answer", response: text,
        }),
        generateFollowups(topicLabel, tier, text, true),
      ]);
      await touchNotebook(notebookId, userId);

      writer.write({ type: "data-mode", id: "mode", data: { value: "guide" } });
      writer.write({ type: "data-topic", id: "topic", data: { name: topicLabel, mastery_score: topic.masteryScore, tier } });
      writer.write({ type: "data-citations", id: "citations", data: { items: citations } });
      writer.write({ type: "data-interaction", id: "interaction", data: { id: interaction.id } });
      writer.write({ type: "data-suggestions", id: "sugs", data: { items: followups } });
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
