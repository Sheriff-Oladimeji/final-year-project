import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export const geminiModel = google("gemini-2.5-flash");

// Disable thinking for cheap one-shot classification calls (intent, correctness, suggestions).
// Pass this as providerOptions.google in generateText/generateObject calls that don't need reasoning.
export const NO_THINKING = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
} as const;
