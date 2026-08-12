// Isolates the REAL shared formatting/breakdown instructions (buildFormattingRules,
// exported from prompts.ts) from Gemini file_search grounding, which needs a live
// notebook + fileSearchStore this eval doesn't have. A materials excerpt is passed
// inline instead of retrieved — everything else is the production instruction text.
import { buildFormattingRules } from "../../src/lib/gemini/prompts";

interface PromptContext {
  vars: Record<string, string>;
}

export default async function explainFormatPrompt({ vars }: PromptContext): Promise<string> {
  return `You are a smart AI tutor. Answer ONLY from the material excerpt below. Never invent facts.

Course material excerpt (use only this — nothing else):
${vars.materials}

Student asked: ${vars.question}

${buildFormattingRules()}

Write the answer now. Do not include a Quick check for this test.`;
}
