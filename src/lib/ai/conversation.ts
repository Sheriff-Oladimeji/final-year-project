import type { Interaction } from "@/db/schema";

// Builds a compact "you said... they said..." transcript from the most recent
// interactions for a single material. Used as context inside Gemini prompts
// so the model knows what's already been covered and only references concepts
// the student has actually encountered.
export function buildConversationContext(
  interactions: Interaction[],
  maxTurns = 6,
): string {
  if (interactions.length === 0) return "";

  // Keep the last `maxTurns` interactions in chronological order.
  const recent = interactions.slice(-maxTurns);
  const lines: string[] = [];

  let prevQuestion: string | null = null;
  for (const it of recent) {
    const isNewChain = prevQuestion === null || it.question !== prevQuestion;
    if (isNewChain) {
      lines.push(`Student: ${it.question}`);
    }
    lines.push(`You: ${it.response}`);
    if (it.studentReply) {
      lines.push(`Student: ${it.studentReply}`);
    }
    prevQuestion = it.question;
  }

  return lines.join("\n");
}
