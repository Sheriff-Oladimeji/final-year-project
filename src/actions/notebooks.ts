"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  createNotebook,
  renameNotebook,
  deleteNotebook,
  getNotebook,
} from "@/db/queries/notebooks";
import { listMaterialsByNotebook } from "@/db/queries/materials";
import { deleteGeminiFile } from "@/lib/gemini/files";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.disabledAt) {
    return { error: "Unauthorised" } as const;
  }
  return session;
}

export async function createNotebookAction(formData: FormData) {
  const session = await requireUser();
  if ("error" in session) return session;

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return { error: "Notebook title is required." };
  if (title.length > 255) return { error: "Title is too long." };

  const nb = await createNotebook({ userId: session.user.id, title });
  revalidatePath("/dashboard");
  redirect(`/notebooks/${nb.id}`);
}

export async function renameNotebookAction(notebookId: string, title: string) {
  const session = await requireUser();
  if ("error" in session) return session;
  const trimmed = title.trim();
  if (!trimmed) return { error: "Title is required." };

  const nb = await renameNotebook(notebookId, session.user.id, trimmed);
  if (!nb) return { error: "Notebook not found." };
  revalidatePath("/dashboard");
  revalidatePath(`/notebooks/${notebookId}`);
  return { data: { id: nb.id, title: nb.title } };
}

export async function deleteNotebookAction(notebookId: string) {
  const session = await requireUser();
  if ("error" in session) return session;

  const nb = await getNotebook(notebookId, session.user.id);
  if (!nb) return { error: "Notebook not found." };

  // Clean up Gemini files before the cascade delete.
  const materials = await listMaterialsByNotebook(session.user.id, notebookId);
  for (const m of materials) {
    if (m.fileSearchId) await deleteGeminiFile(m.fileSearchId);
  }

  await deleteNotebook(notebookId, session.user.id);
  revalidatePath("/dashboard");
  return { data: { success: true } };
}
