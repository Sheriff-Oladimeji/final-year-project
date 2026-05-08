import { headers } from "next/headers";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
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

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.disabledAt) {
    return new Response("Unauthorised", { status: 401 });
  }

  const body = (await req.json()) as ChatRequestBody;
  const { messages, materialId, interactionId } = body;

  if (!materialId) {
    return new Response("Missing materialId", { status: 400 });
  }

  const userText = lastUserText(messages);
  if (!userText) {
    return new Response("Empty message", { status: 400 });
  }

  const userId = session.user.id;
  const sessionId = session.session.id;

  const material = await getReadyMaterial(materialId, userId);
  if (!material) {
    return new Response("Material not ready or not found", { status: 404 });
  }

  let fileParts: Awaited<ReturnType<typeof buildFileContentParts>>;
  try {
    fileParts = await buildFileContentParts(material);
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "File load failed", {
      status: 500,
    });
  }

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      // ── REPLY PHASE ──────────────────────────────────────────────────────
      if (interactionId) {
        const interaction = await getInteraction(interactionId, userId);
        if (!interaction) throw new Error("Interaction not found");
        if (interaction.correctness !== "unscored") {
          throw new Error("This interaction has already been scored.");
        }

        const contextText = interaction.retrievedContext ?? "";

        // Score the answer
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

        await Promise.all([
          updateMasteryScore(interaction.topicId, newScore),
          updateInteraction(interactionId, userId, {
            studentReply: userText,
            correctness,
            scoreDelta: delta,
          }),
        ]);

        // Emit score data part
        writer.write({
          type: "data-score",
          data: { correctness, score_delta: delta, new_score: newScore },
        });

        // Emit topic so frontend can render the topic badge
        writer.write({
          type: "data-topic",
          data: { name: topic.name },
        });

        // Stream the next guided question
        const nextTier = getMasteryTier(newScore);
        const prompt = TIER_TEMPLATES[nextTier](interaction.question, contextText, topic.name);

        const result = streamText({
          model: geminiModel,
          messages: [
            {
              role: "user",
              content: [{ type: "text", text: prompt }, ...fileParts],
            },
          ],
          onFinish: async ({ text }) => {
            const next = await createInteraction({
              userId,
              sessionId,
              materialId,
              topicId: topic.id,
              question: interaction.question,
              retrievedContext: contextText,
              promptTemplate: nextTier,
              response: text,
            });
            writer.write({
              type: "data-interaction",
              data: { id: next.id },
            });
          },
        });

        writer.merge(result.toUIMessageStream());
        return;
      }

      // ── ASK PHASE ────────────────────────────────────────────────────────
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
      const topic = await getOrCreateTopic(userId, topicLabel);
      const tier = getMasteryTier(topic.masteryScore);

      // Emit topic + citations early so the UI can render them while text streams
      writer.write({ type: "data-topic", data: { name: topicLabel } });
      writer.write({ type: "data-citations", data: { items: citations } });

      const prompt = TIER_TEMPLATES[tier](userText, contextText, topicLabel);
      const result = streamText({
        model: geminiModel,
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: prompt }, ...fileParts],
          },
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
          writer.write({
            type: "data-interaction",
            data: { id: interaction.id },
          });
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
