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
import { geminiModel } from "@/lib/ai/model";
import { buildFileContentParts } from "@/lib/ai/file-parts";
import type { ChatMessage } from "@/lib/ai/chat-types";
import {
  CLASSIFY_TOPIC_TEMPLATE,
  RETRIEVE_PROMPT,
  TIER_TEMPLATES,
  CLASSIFY_CORRECTNESS_TEMPLATE,
  INTENT_CLASSIFIER_TEMPLATE,
  ANSWER_TEMPLATE,
  META_TEMPLATE,
  FOLLOWUP_SUGGESTIONS_TEMPLATE,
} from "@/lib/gemini/prompts";
import { getReadyMaterial } from "@/db/queries/materials";
import { getOrCreateTopic, updateMasteryScore } from "@/db/queries/topics";
import {
  createInteraction,
  updateInteraction,
  getInteraction,
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
  materialId: string;
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
  // Cheap heuristic shortcut for clear give-up phrases — saves a Gemini call.
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
    });
    const label = text.trim().toLowerCase().split(/\s/)[0] ?? "";
    if (["new_question", "answer_attempt", "give_up", "meta"].includes(label)) {
      return label as Intent;
    }
  } catch {
    // fall through
  }
  // If classifier fails, use the structural cue: interactionId present → reply.
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

const SuggestionsSchema = z.object({ suggestions: z.array(z.string()).length(3) });

async function generateFollowups(
  topic: string,
  tier: string,
  lastAssistant: string,
  isGuidedQuestion: boolean,
): Promise<string[]> {
  try {
    const { object } = await generateObject({
      model: geminiModel,
      schema: SuggestionsSchema,
      prompt: FOLLOWUP_SUGGESTIONS_TEMPLATE(topic, tier, lastAssistant, isGuidedQuestion),
    });
    return object.suggestions;
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  // Pre-stream setup. Anything thrown here returns a real HTTP 500 (no stream
  // protocol involved) so wrap and log everything for diagnosis.
  let session: Awaited<ReturnType<typeof auth.api.getSession>>;
  let body: ChatRequestBody;
  let userText: string;
  let userId: string;
  let sessionId: string;
  let materialId: string;
  let interactionId: string | undefined;
  let material: Awaited<ReturnType<typeof getReadyMaterial>>;
  let fileParts: Awaited<ReturnType<typeof buildFileContentParts>>;
  let priorInteraction: Awaited<ReturnType<typeof getInteraction>> | null;
  let intent: Intent;

  try {
    session = await auth.api.getSession({ headers: await headers() });
    if (!session || session.user.disabledAt) {
      return new Response("Unauthorised", { status: 401 });
    }

    body = (await req.json()) as ChatRequestBody;
    materialId = body.materialId;
    interactionId = body.interactionId;

    if (!materialId) return new Response("Missing materialId", { status: 400 });
    userText = lastUserText(body.messages);
    if (!userText) return new Response("Empty message", { status: 400 });

    userId = session.user.id;
    sessionId = session.session.id;

    material = await getReadyMaterial(materialId, userId);
    if (!material) return new Response("Material not ready or not found", { status: 404 });

    fileParts = await buildFileContentParts(material);

    priorInteraction = interactionId ? await getInteraction(interactionId, userId) : null;
    const lastGuidedQuestion = priorInteraction?.response ?? null;
    intent = await classifyIntent(userText, lastGuidedQuestion);

    // Stale interactionId: the prior interaction is already scored. Treat
    // this as a fresh question rather than throwing.
    if (
      intent === "answer_attempt" &&
      priorInteraction &&
      priorInteraction.correctness !== "unscored"
    ) {
      console.warn(
        "[/api/chat] answer_attempt against already-scored interaction; reclassifying as new_question",
        { interactionId, correctness: priorInteraction.correctness },
      );
      intent = "new_question";
      priorInteraction = null;
    }
  } catch (err) {
    console.error("[/api/chat] preflight error", err);
    const message =
      err instanceof Error ? `${err.name}: ${err.message}` : "Server error";
    return new Response(message, { status: 500 });
  }

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      // ── META: explain the system; no scoring, no topic data ───────────
      if (intent === "meta") {
        const result = streamText({
          model: geminiModel,
          prompt: META_TEMPLATE(userText),
          onFinish: async ({ text }) => {
            const followups = await generateFollowups("the LearnAI app", "meta", text, false);
            writer.write({ type: "data-mode", id: "mode", data: { value: "meta" } });
            if (followups.length) {
              writer.write({
                type: "data-suggestions",
                id: "sugs",
                data: { items: followups },
              });
            }
          },
        });
        writer.merge(result.toUIMessageStream());
        return;
      }

      // ── GIVE_UP or ANSWER_ATTEMPT: we need the prior interaction's
      //    context. If the user gave up at the very start (no prior),
      //    fall through to ASK to build context first.
      if (intent === "give_up" && priorInteraction) {
        const interaction = priorInteraction;
        const contextText = interaction.retrievedContext ?? "";
        const topicRows = await db
          .select()
          .from(topics)
          .where(eq(topics.id, interaction.topicId));
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

        const prompt = ANSWER_TEMPLATE(interaction.question, contextText, topic.name);
        const result = streamText({
          model: geminiModel,
          messages: [
            { role: "user", content: [{ type: "text", text: prompt }, ...fileParts] },
          ],
          onFinish: async ({ text }) => {
            const next = await createInteraction({
              userId,
              sessionId,
              materialId,
              topicId: topic.id,
              question: interaction.question,
              retrievedContext: contextText,
              promptTemplate: "answer",
              response: text,
            });
            const followups = await generateFollowups(topic.name, newTier, text, false);
            writer.write({ type: "data-mode", id: "mode", data: { value: "answer" } });
            writer.write({
              type: "data-topic",
              id: "topic",
              data: { name: topic.name, mastery_score: newScore, tier: newTier },
            });
            writer.write({
              type: "data-score",
              id: "score",
              data: {
                correctness: "give_up",
                score_delta: scoreDelta("give_up"),
                new_score: newScore,
                new_tier: newTier,
              },
            });
            writer.write({ type: "data-interaction", id: "interaction", data: { id: next.id } });
            if (followups.length) {
              writer.write({
                type: "data-suggestions",
                id: "sugs",
                data: { items: followups },
              });
            }
          },
        });
        writer.merge(result.toUIMessageStream());
        return;
      }

      // ── ANSWER_ATTEMPT: existing reply flow with smarter outputs ──────
      // Preflight already reclassifies stale (already-scored) answer_attempts
      // as new_question, so the priorInteraction here is always unscored.
      if (intent === "answer_attempt" && priorInteraction) {
        const interaction = priorInteraction;
        const contextText = interaction.retrievedContext ?? "";
        const correctnessRaw = await generateText({
          model: geminiModel,
          prompt: CLASSIFY_CORRECTNESS_TEMPLATE(
            interaction.response,
            contextText,
            userText,
            false,
          ),
        });
        const correctness = parseCorrectness(correctnessRaw.text);
        const delta = scoreDelta(correctness);

        const topicRows = await db
          .select()
          .from(topics)
          .where(eq(topics.id, interaction.topicId));
        const topic = topicRows[0];
        const newScore = clipScore(topic.masteryScore + delta);
        const newTier = getMasteryTier(newScore);

        await Promise.all([
          updateMasteryScore(interaction.topicId, newScore),
          updateInteraction(interaction.id, userId, {
            studentReply: userText,
            correctness,
            scoreDelta: delta,
          }),
        ]);

        const prompt = TIER_TEMPLATES[newTier](interaction.question, contextText, topic.name);
        const result = streamText({
          model: geminiModel,
          messages: [
            { role: "user", content: [{ type: "text", text: prompt }, ...fileParts] },
          ],
          onFinish: async ({ text }) => {
            const next = await createInteraction({
              userId,
              sessionId,
              materialId,
              topicId: topic.id,
              question: interaction.question,
              retrievedContext: contextText,
              promptTemplate: newTier,
              response: text,
            });
            const followups = await generateFollowups(topic.name, newTier, text, true);
            writer.write({ type: "data-mode", id: "mode", data: { value: "guide" } });
            writer.write({
              type: "data-topic",
              id: "topic",
              data: { name: topic.name, mastery_score: newScore, tier: newTier },
            });
            writer.write({
              type: "data-score",
              id: "score",
              data: { correctness, score_delta: delta, new_score: newScore, new_tier: newTier },
            });
            writer.write({ type: "data-interaction", id: "interaction", data: { id: next.id } });
            if (followups.length) {
              writer.write({
                type: "data-suggestions",
                id: "sugs",
                data: { items: followups },
              });
            }
          },
        });
        writer.merge(result.toUIMessageStream());
        return;
      }

      // ── ASK (new_question, OR give_up with no prior context) ──────────
      const [topicGen, retrievedGen] = await Promise.all([
        generateText({
          model: geminiModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: CLASSIFY_TOPIC_TEMPLATE(userText) },
                ...fileParts,
              ],
            },
          ],
        }),
        generateText({
          model: geminiModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: RETRIEVE_PROMPT(userText) },
                ...fileParts,
              ],
            },
          ],
        }),
      ]);

      let topicLabel = topicGen.text.toLowerCase().trim().replace(/\.$/, "");
      if (topicLabel.length > 100) topicLabel = topicLabel.slice(0, 100);

      const { contextText, citations } = parseRetrieved(retrievedGen.text);
      const topic = await getOrCreateTopic(userId, materialId, topicLabel);
      const tier = getMasteryTier(topic.masteryScore);
      const prompt = TIER_TEMPLATES[tier](userText, contextText, topicLabel);

      const result = streamText({
        model: geminiModel,
        messages: [
          { role: "user", content: [{ type: "text", text: prompt }, ...fileParts] },
        ],
        onFinish: async ({ text }) => {
          const interaction = await createInteraction({
            userId,
            sessionId,
            materialId,
            topicId: topic.id,
            question: userText,
            retrievedContext: contextText,
            promptTemplate: tier,
            response: text,
          });
          const followups = await generateFollowups(topicLabel, tier, text, true);
          writer.write({ type: "data-mode", id: "mode", data: { value: "guide" } });
          writer.write({
            type: "data-topic",
            id: "topic",
            data: { name: topicLabel, mastery_score: topic.masteryScore, tier },
          });
          writer.write({
            type: "data-citations",
            id: "citations",
            data: { items: citations },
          });
          writer.write({ type: "data-interaction", id: "interaction", data: { id: interaction.id } });
          if (followups.length) {
            writer.write({
              type: "data-suggestions",
              id: "sugs",
              data: { items: followups },
            });
          }
        },
      });
      writer.merge(result.toUIMessageStream());
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
