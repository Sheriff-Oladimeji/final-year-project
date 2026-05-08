import { generateObject } from "ai";
import { z } from "zod";
import { geminiModel } from "./model";
import { SUGGESTIONS_PROMPT } from "@/lib/gemini/prompts";
import type { Material } from "@/db/schema";

const SuggestionsSchema = z.object({
  suggestions: z.array(z.string()).length(4),
});

// Calls Gemini with the material's uploaded file to produce 4 starter
// questions. Returns [] on any failure — suggestions are nice-to-have, not
// blocking for the upload flow.
export async function generateMaterialSuggestions(material: Material): Promise<string[]> {
  if (!material.fileSearchId) return [];

  const fileUri = `https://generativelanguage.googleapis.com/v1beta/${material.fileSearchId}`;
  const mediaType = material.kind === "pdf" ? "application/pdf" : "text/plain";

  try {
    const { object } = await generateObject({
      model: geminiModel,
      schema: SuggestionsSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SUGGESTIONS_PROMPT },
            { type: "file", data: new URL(fileUri), mediaType },
          ],
        },
      ],
    });
    return object.suggestions;
  } catch {
    return [];
  }
}
