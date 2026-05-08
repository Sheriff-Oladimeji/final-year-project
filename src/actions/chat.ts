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

// Convert raw upstream errors (e.g. Gemini API JSON) to user-friendly text.
function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Our own thrown errors are clean sentences; pass them through.
  if (!raw.startsWith("{") && !raw.includes("INVALID_ARGUMENT") && !raw.includes("PERMISSION_DENIED")) {
    return raw;
  }
  return "Something went wrong while processing your question. Please try again.";
}

export async function askAction(question: string, materialId: string) {
  const session = await requireStudent();
  if ("error" in session) return session;
  if (!question.trim()) return { error: "Please enter a question." };
  if (!materialId) return { error: "No material selected." };

  try {
    const result = await ask(question.trim(), session.user.id, materialId, session.session.id);
    return { data: result };
  } catch (err: unknown) {
    return { error: friendlyError(err) };
  }
}

export async function replyAction(
  interactionId: string,
  studentReply: string,
  materialId: string,
  hintRequested = false,
) {
  const session = await requireStudent();
  if ("error" in session) return session;
  if (!studentReply.trim()) return { error: "Please enter a reply." };
  if (!materialId) return { error: "No material selected." };

  try {
    const result = await reply(
      interactionId,
      studentReply.trim(),
      hintRequested,
      session.user.id,
      materialId,
      session.session.id,
    );
    return { data: result };
  } catch (err: unknown) {
    return { error: friendlyError(err) };
  }
}
