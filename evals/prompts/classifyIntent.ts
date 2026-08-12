// Renders the REAL production intent-classification prompt.
import { INTENT_CLASSIFIER_TEMPLATE } from "../../src/lib/gemini/prompts";

interface PromptContext {
  vars: Record<string, string>;
}

export default async function classifyIntentPrompt({ vars }: PromptContext): Promise<string> {
  return INTENT_CLASSIFIER_TEMPLATE(vars.userText, vars.lastGuidedQuestion || null);
}
