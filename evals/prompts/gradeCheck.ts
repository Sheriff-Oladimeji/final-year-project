// Renders the REAL production grading prompt (src/lib/gemini/prompts.ts) so this
// eval tests exactly what ships, not a hand-copied stand-in that can drift.
import { CLASSIFY_CHECK_TEMPLATE } from "../../src/lib/gemini/prompts";

interface PromptContext {
  vars: Record<string, string>;
}

export default async function gradeCheckPrompt({ vars }: PromptContext): Promise<string> {
  return CLASSIFY_CHECK_TEMPLATE(vars.tutorResponse, vars.studentReply);
}
