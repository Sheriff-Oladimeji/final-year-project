import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { geminiModel } from "./model";
import { SUGGESTIONS_PROMPT, NOTEBOOK_SUMMARY_TEMPLATE } from "@/lib/gemini/prompts";
import type { Material } from "@/db/schema";
import { db } from "@/db";
import { notebooks } from "@/db/schema";
import { eq } from "drizzle-orm";

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
 * Notebook-level overview (summary + starter questions) shown before the
 * student's first message. Regenerated whenever a source is added — see
 * regenerateNotebookSummary() in src/actions/materials.ts.
 */
export async function generateNotebookSummary(
  notebookId: string,
  notebookTitle: string,
): Promise<{ summary: string; suggestions: string[] } | null> {
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

    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { summary?: unknown; suggestions?: unknown };
    if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return null;

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.slice(0, 3).filter((s): s is string => typeof s === "string")
      : [];

    return { summary: parsed.summary.trim(), suggestions };
  } catch {
    return null;
  }
}
