import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-2.5-flash";

const globalForGenAI = globalThis as unknown as { _genai?: GoogleGenAI };

export function getClient(): GoogleGenAI {
  if (!globalForGenAI._genai) {
    globalForGenAI._genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return globalForGenAI._genai;
}
