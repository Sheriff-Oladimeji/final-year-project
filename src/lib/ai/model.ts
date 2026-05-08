import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Wraps the Google provider so we use the project's existing GEMINI_API_KEY
// (the AI SDK default expects GOOGLE_GENERATIVE_AI_API_KEY, which we don't set).
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export const GEMINI_MODEL_ID = "gemini-2.5-flash";
export const geminiModel = google(GEMINI_MODEL_ID);
