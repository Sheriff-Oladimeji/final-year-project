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
import {
  createFileSearchStore,
  deleteFileSearchStore,
} from "@/lib/gemini/fileSearch";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.banned) {
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

  // Create the File Search store first, then persist the notebook with its name.
  let fileSearchStoreName: string | undefined;
  try {
    fileSearchStoreName = await createFileSearchStore(title);
  } catch {
    // Non-fatal — notebook still works, materials just can't be added until the store is created.
  }

  const nb = await createNotebook({ userId: session.user.id, title, fileSearchStoreName });
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

  // Delete the File Search store (takes all documents with it) before DB cascade.
  if (nb.fileSearchStoreName) {
    await deleteFileSearchStore(nb.fileSearchStoreName);
  }

  await deleteNotebook(notebookId, session.user.id);
  revalidatePath("/dashboard");
  return { data: { success: true } };
}
