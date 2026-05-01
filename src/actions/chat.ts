"use server";

import { getSession } from "@/lib/auth/session";
import { ask, reply } from "@/lib/gemini/pipeline";

async function requireStudent() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "student") {
    return { error: "Unauthorised" } as const;
  }
  return session;
}

export async function askAction(question: string) {
  const session = await requireStudent();
  if ("error" in session) return session;

  if (!question.trim()) return { error: "Please enter a question." };

  try {
    const result = await ask(question.trim(), session.userId);
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Something went wrong.";
    return { error: msg };
  }
}

export async function replyAction(
  interactionId: string,
  studentReply: string,
  hintRequested = false,
) {
  const session = await requireStudent();
  if ("error" in session) return session;

  if (!studentReply.trim()) return { error: "Please enter a reply." };

  try {
    const result = await reply(interactionId, studentReply.trim(), hintRequested, session.userId);
    return { data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Something went wrong.";
    return { error: msg };
  }
}
