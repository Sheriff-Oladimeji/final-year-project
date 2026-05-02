import type { Part } from "@google/genai";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { getClient, GEMINI_MODEL } from "./client";
import { buildFileParts, getReadyFileIds } from "./files";
import { getReadyMaterials } from "@/db/queries/materials";
import { getOrCreateTopic, updateMasteryScore } from "@/db/queries/topics";
import { createInteraction, updateInteraction, getInteraction } from "@/db/queries/interactions";
import { getMasteryTier, scoreDelta, clipScore } from "@/lib/mastery";
import {
  CLASSIFY_TOPIC_TEMPLATE,
  RETRIEVE_PROMPT,
  TIER_TEMPLATES,
  CLASSIFY_CORRECTNESS_TEMPLATE,
} from "./prompts";
import type { AskResponse, ReplyResponse, Citation } from "@/types";

async function generate(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.models.generateContent({ model: GEMINI_MODEL, contents: prompt });
  return response.text?.trim() ?? "";
}

async function generateWithFiles(prompt: string, fileParts: Part[]): Promise<string> {
  const client = getClient();
  const contents = [...fileParts, { text: prompt }];
  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: contents as Parameters<typeof client.models.generateContent>[0]["contents"],
  });
  return response.text?.trim() ?? "";
}

async function classifyTopic(question: string, fileParts: Part[]): Promise<string> {
  let label = await generateWithFiles(CLASSIFY_TOPIC_TEMPLATE(question), fileParts);
  label = label.toLowerCase().trim().replace(/\.$/, "");
  return label.length > 100 ? label.slice(0, 100) : label;
}

async function retrieveContext(
  question: string,
  fileParts: Part[],
): Promise<{ contextText: string; citations: Citation[] }> {
  const raw = await generateWithFiles(RETRIEVE_PROMPT(question), fileParts);

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
    return { contextText: raw, citations: [{ source: "course material", excerpt: raw.slice(0, 500) }] };
  }

  return { contextText: contextParts.join("\n\n"), citations };
}

async function classifyCorrectness(
  guidedQuestion: string,
  context: string,
  studentReply: string,
  hintRequested: boolean,
): Promise<string> {
  const raw = await generate(CLASSIFY_CORRECTNESS_TEMPLATE(guidedQuestion, context, studentReply, hintRequested));
  const label = raw.trim().toLowerCase().split(/\s/)[0] ?? "incorrect";
  return ["correct", "correct_with_hint", "incorrect"].includes(label) ? label : "incorrect";
}

export async function ask(
  question: string,
  userId: string,
  sessionId?: string,
): Promise<AskResponse> {
  const materials = await getReadyMaterials(userId);
  if (materials.length === 0) {
    throw new Error(
      "You have no indexed materials yet. Please upload a PDF or YouTube URL before asking a question.",
    );
  }

  const fileIds = await getReadyFileIds(materials);
  if (fileIds.length === 0) {
    throw new Error("None of your materials could be loaded. Please re-upload them.");
  }

  const fileParts = buildFileParts(fileIds);

  const [topicLabel, { contextText, citations }] = await Promise.all([
    classifyTopic(question, fileParts),
    retrieveContext(question, fileParts),
  ]);

  const topic = await getOrCreateTopic(userId, topicLabel);
  const tier = getMasteryTier(topic.masteryScore);
  const prompt = TIER_TEMPLATES[tier](question, contextText, topicLabel);
  const guidedQuestion = await generateWithFiles(prompt, fileParts);

  const interaction = await createInteraction({
    userId,
    sessionId,
    topicId: topic.id,
    question,
    retrievedContext: contextText,
    promptTemplate: tier,
    response: guidedQuestion,
  });

  return {
    guided_question: guidedQuestion,
    topic: topicLabel,
    interaction_id: interaction.id,
    citations,
  };
}

export async function reply(
  interactionId: string,
  studentReply: string,
  hintRequested: boolean,
  userId: string,
  sessionId?: string,
): Promise<ReplyResponse> {
  const interaction = await getInteraction(interactionId, userId);
  if (!interaction) throw new Error("Interaction not found");
  if (interaction.correctness !== "unscored") {
    throw new Error("This interaction has already been scored. Start a new question.");
  }

  const contextText = interaction.retrievedContext ?? "";
  const correctness = await classifyCorrectness(
    interaction.response,
    contextText,
    studentReply,
    hintRequested,
  );

  const delta = scoreDelta(correctness);
  const topicRows = await db.select().from(topics).where(eq(topics.id, interaction.topicId));
  const topic = topicRows[0];
  const newScore = clipScore(topic.masteryScore + delta);

  await Promise.all([
    updateMasteryScore(interaction.topicId, newScore),
    updateInteraction(interactionId, userId, { studentReply, correctness, scoreDelta: delta }),
  ]);

  const materials = await getReadyMaterials(userId);
  let nextGuidedQuestion = "";
  let nextInteractionId = "";

  if (materials.length > 0) {
    const fileIds = await getReadyFileIds(materials);
    if (fileIds.length > 0) {
      const fileParts = buildFileParts(fileIds);
      const nextTier = getMasteryTier(newScore);
      const prompt = TIER_TEMPLATES[nextTier](interaction.question, contextText, topic.name);
      nextGuidedQuestion = await generateWithFiles(prompt, fileParts);

      const nextInteraction = await createInteraction({
        userId,
        sessionId,
        topicId: topic.id,
        question: interaction.question,
        retrievedContext: contextText,
        promptTemplate: nextTier,
        response: nextGuidedQuestion,
      });
      nextInteractionId = nextInteraction.id;
    }
  }

  return {
    correctness: correctness as ReplyResponse["correctness"],
    score_delta: delta,
    new_score: newScore,
    next_guided_question: nextGuidedQuestion,
    next_interaction_id: nextInteractionId,
  };
}
