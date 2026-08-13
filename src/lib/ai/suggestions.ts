import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { geminiModel } from "./model";
import { SUGGESTIONS_PROMPT, NOTEBOOK_SUMMARY_TEMPLATE, EXTRACT_TOPICS_TEMPLATE } from "@/lib/gemini/prompts";
import type { Material } from "@/db/schema";
import { db } from "@/db";
import { notebooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizeTopicLabel } from "@/lib/topics";

const JSON_INSTRUCTIONS = `\n\nReturn your answer as a JSON array of exactly 4 strings and nothing else.
Example: ["question 1", "question 2", "question 3", "question 4"]`;

export async function generateMaterialSuggestions(material: Material): Promise<string[]> {
  const notebookRows = await db
    .select({ fileSearchStoreName: notebooks.fileSearchStoreName })
    .from(notebooks)
    .where(eq(notebooks.id, material.notebookId))
    .limit(1);

  const storeName = notebookRows[0]?.fileSearchStoreName;
  if (!storeName) return [];

  try {
    const { text } = await generateText({
      model: geminiModel,
      tools: {
        file_search: google.tools.fileSearch({ fileSearchStoreNames: [storeName] }),
      },
      prompt: SUGGESTIONS_PROMPT + JSON_INSTRUCTIONS,
    });

    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed: unknown = JSON.parse(match[0]);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 4).filter((s): s is string => typeof s === "string");
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Notebook-level overview shown before the student's first message.
 * Generated once per notebook — see the claim-slot gating in
 * regenerateNotebookSummary() in src/actions/materials.ts. Starter chips are
 * no longer a separate LLM-generated field here — ChatThread derives them
 * directly from the same topic taxonomy used for the sidebar (see
 * extractNotebookTopics below), so the two can't drift out of sync.
 */
export async function generateNotebookSummary(
  notebookId: string,
  notebookTitle: string,
): Promise<string | null> {
  const notebookRows = await db
    .select({ fileSearchStoreName: notebooks.fileSearchStoreName })
    .from(notebooks)
    .where(eq(notebooks.id, notebookId))
    .limit(1);

  const storeName = notebookRows[0]?.fileSearchStoreName;
  if (!storeName) return null;

  try {
    const { text } = await generateText({
      model: geminiModel,
      tools: {
        file_search: google.tools.fileSearch({ fileSearchStoreNames: [storeName] }),
      },
      prompt: NOTEBOOK_SUMMARY_TEMPLATE(notebookTitle),
    });

    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Extracts (and reconciles against) this notebook's topic taxonomy. Grounds
 * across the WHOLE file-search store every call — not scoped to a single
 * material, since Gemini File Search has no first-class single-document
 * retrieval scope without custom_metadata plumbing this app doesn't do yet
 * — and feeds in the existing topic list so genuinely repeated concepts
 * reuse their exact label instead of spawning near-duplicates. Called from
 * regenerateTopicTaxonomy() in src/actions/materials.ts on every material
 * upload, not gated to the notebook's first material.
 */
export async function extractNotebookTopics(
  notebookId: string,
  notebookTitle: string,
  existingTopics: string[],
): Promise<string[]> {
  const notebookRows = await db
    .select({ fileSearchStoreName: notebooks.fileSearchStoreName })
    .from(notebooks)
    .where(eq(notebooks.id, notebookId))
    .limit(1);

  const storeName = notebookRows[0]?.fileSearchStoreName;
  if (!storeName) return [];

  try {
    const { text } = await generateText({
      model: geminiModel,
      tools: {
        file_search: google.tools.fileSearch({ fileSearchStoreNames: [storeName] }),
      },
      prompt: EXTRACT_TOPICS_TEMPLATE(notebookTitle, existingTopics),
    });

    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as { topics?: unknown };
    const rawTopics = Array.isArray(parsed.topics) ? parsed.topics : [];

    return Array.from(
      new Set(
        rawTopics
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map(normalizeTopicLabel),
      ),
    );
  } catch {
    return [];
  }
}
