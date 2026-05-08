"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ask, reply } from "@/lib/gemini/pipeline";

async function requireStudent() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.disabledAt) {
    return { error: "Unauthorised" } as const;
  }
  return session;
}

export async function askAction(question: string) {
  const session = await requireStudent();
  if ("error" in session) return session;
  if (!question.trim()) return { error: "Please enter a question." };

  try {
    const result = await ask(question.trim(), session.user.id, session.session.id);
    return { data: result };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
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
    const result = await reply(
      interactionId,
      studentReply.trim(),
      hintRequested,
      session.user.id,
      session.session.id,
    );
    return { data: result };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Something went wrong." };
  }
}
