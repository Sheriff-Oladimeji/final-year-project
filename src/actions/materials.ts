"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createMaterial,
  deleteMaterial,
  setMaterialStatus,
  setMaterialSuggestions,
  getMaterial,
  countMaterialsInNotebook,
  MATERIALS_PER_NOTEBOOK_CAP,
} from "@/db/queries/materials";
import { getNotebook, touchNotebook } from "@/db/queries/notebooks";
import { fetchTranscript } from "@/lib/youtube";
import { uploadBytes, deleteGeminiFile } from "@/lib/gemini/files";
import { generateMaterialSuggestions } from "@/lib/ai/suggestions";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.disabledAt) {
    return { error: "Unauthorised" } as const;
  }
  return session;
}

async function checkCanAddMaterial(userId: string, notebookId: string) {
  const nb = await getNotebook(notebookId, userId);
  if (!nb) return { error: "Notebook not found." } as const;
  const existing = await countMaterialsInNotebook(userId, notebookId);
  if (existing >= MATERIALS_PER_NOTEBOOK_CAP) {
    return {
      error: `You've reached the limit of ${MATERIALS_PER_NOTEBOOK_CAP} sources for this notebook. Delete one to add another.`,
    } as const;
  }
  return null;
}

async function persistSuggestions(materialId: string, userId: string) {
  const material = await getMaterial(materialId, userId);
  if (!material) return;
  const suggestions = await generateMaterialSuggestions(material);
  if (suggestions.length > 0) {
    await setMaterialSuggestions(materialId, suggestions);
  }
}

export async function uploadPdfAction(formData: FormData) {
  const session = await requireUser();
  if ("error" in session) return session;

  const notebookId = formData.get("notebookId") as string | null;
  if (!notebookId) return { error: "Missing notebook." };
  const capCheck = await checkCanAddMaterial(session.user.id, notebookId);
  if (capCheck) return capCheck;

  const file = formData.get("file") as File | null;
  if (!file || file.type !== "application/pdf") {
    return { error: "Please upload a valid PDF file." };
  }

  const material = await createMaterial({
    userId: session.user.id,
    notebookId,
    kind: "pdf",
    displayName: file.name,
    sourceUri: file.name,
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileSearchId = await uploadBytes(buffer, "application/pdf", file.name);

    await setMaterialStatus(material.id, "ready", { fileSearchId, indexedAt: new Date() });
    await touchNotebook(notebookId, session.user.id);

    void persistSuggestions(material.id, session.user.id);

    revalidatePath(`/notebooks/${notebookId}`);
    return { data: { id: material.id, status: "ready" } };
  } catch (err: unknown) {
    await setMaterialStatus(material.id, "failed");
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function submitYoutubeAction(formData: FormData) {
  const session = await requireUser();
  if ("error" in session) return session;

  const notebookId = formData.get("notebookId") as string | null;
  if (!notebookId) return { error: "Missing notebook." };
  const capCheck = await checkCanAddMaterial(session.user.id, notebookId);
  if (capCheck) return capCheck;

  const url = (formData.get("url") as string | null)?.trim();
  if (!url) return { error: "Please provide a YouTube URL." };

  let videoId: string;
  let transcriptText: string;
  try {
    const result = await fetchTranscript(url);
    videoId = result.videoId;
    transcriptText = result.text;
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to fetch transcript." };
  }

  const displayName = `YouTube: ${videoId}`;
  const material = await createMaterial({
    userId: session.user.id,
    notebookId,
    kind: "youtube",
    displayName,
    sourceUri: url,
    content: transcriptText,
  });

  try {
    const fileSearchId = await uploadBytes(
      Buffer.from(transcriptText, "utf-8"),
      "text/plain",
      displayName,
    );
    await setMaterialStatus(material.id, "ready", { fileSearchId, indexedAt: new Date() });
    await touchNotebook(notebookId, session.user.id);

    void persistSuggestions(material.id, session.user.id);

    revalidatePath(`/notebooks/${notebookId}`);
    return { data: { id: material.id, status: "ready" } };
  } catch (err: unknown) {
    await setMaterialStatus(material.id, "failed");
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function deleteMaterialAction(materialId: string) {
  const session = await requireUser();
  if ("error" in session) return session;

  const material = await getMaterial(materialId, session.user.id);
  if (!material) return { error: "Material not found." };

  if (material.fileSearchId) await deleteGeminiFile(material.fileSearchId);

  await deleteMaterial(materialId, session.user.id);
  revalidatePath(`/notebooks/${material.notebookId}`);
  return { data: { success: true, notebookId: material.notebookId } };
}
