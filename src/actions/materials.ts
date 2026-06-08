"use server";

import { after } from "next/server";
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
import { del } from "@vercel/blob";
import { fetchTranscript } from "@/lib/youtube";
import { uploadDocumentToStore, deleteDocumentFromStore } from "@/lib/gemini/fileSearch";
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
  if (!nb.fileSearchStoreName) return { error: "This notebook's file store isn't ready yet." } as const;
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

/**
 * Indexes a PDF that the browser already uploaded to Vercel Blob. The client
 * uploads the file straight to Blob (bypassing the 4.5 MB Vercel function body
 * limit), then calls this with just the blob URL and file name (a tiny payload).
 * We download the bytes server-side, index them into Gemini File Search, then
 * delete the blob so it is only used as transit storage.
 */
export async function indexPdfFromBlobAction(input: {
  notebookId: string;
  blobUrl: string;
  fileName: string;
}) {
  const session = await requireUser();
  if ("error" in session) return session;

  const { notebookId, blobUrl, fileName } = input;
  if (!notebookId) return { error: "Missing notebook." };
  if (!blobUrl) return { error: "Missing uploaded file." };
  const capCheck = await checkCanAddMaterial(session.user.id, notebookId);
  if (capCheck) {
    // Clean up the orphaned blob since we won't index it.
    await del(blobUrl).catch(() => {});
    return capCheck;
  }

  const nb = await getNotebook(notebookId, session.user.id);
  const storeName = nb!.fileSearchStoreName!;

  const material = await createMaterial({
    userId: session.user.id,
    notebookId,
    kind: "pdf",
    displayName: fileName,
    sourceUri: fileName,
  });

  revalidatePath(`/notebooks/${notebookId}`);

  const materialId = material.id;
  const userId = session.user.id;

  after(async () => {
    try {
      const res = await fetch(blobUrl);
      if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      const documentName = await uploadDocumentToStore(storeName, buffer, "application/pdf", fileName);
      await setMaterialStatus(materialId, "ready", { fileSearchId: documentName, indexedAt: new Date() });
      await touchNotebook(notebookId, userId);
      await persistSuggestions(materialId, userId);
    } catch (err) {
      console.error("[indexPdfFromBlobAction] after() failed:", err);
      await setMaterialStatus(materialId, "failed");
    } finally {
      // Blob was only transit storage; remove it whether indexing succeeded or not.
      await del(blobUrl).catch(() => {});
    }
  });

  return { data: { id: materialId, status: "pending" } };
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

  let title: string;
  let transcriptText: string;
  try {
    const result = await fetchTranscript(url);
    title = result.title;
    transcriptText = result.text;
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to fetch transcript." };
  }

  const nb = await getNotebook(notebookId, session.user.id);
  const storeName = nb!.fileSearchStoreName!;

  const material = await createMaterial({
    userId: session.user.id,
    notebookId,
    kind: "youtube",
    displayName: title,
    sourceUri: url,
    content: transcriptText,
  });

  revalidatePath(`/notebooks/${notebookId}`);

  const materialId = material.id;
  const userId = session.user.id;

  after(async () => {
    try {
      const documentName = await uploadDocumentToStore(
        storeName,
        Buffer.from(transcriptText, "utf-8"),
        "text/plain",
        title,
      );
      await setMaterialStatus(materialId, "ready", { fileSearchId: documentName, indexedAt: new Date() });
      await touchNotebook(notebookId, userId);
      await persistSuggestions(materialId, userId);
    } catch (err) {
      console.error("[submitYoutubeAction] after() failed:", err);
      await setMaterialStatus(materialId, "failed");
    }
  });

  return { data: { id: materialId, status: "pending" } };
}

export async function deleteMaterialAction(materialId: string) {
  const session = await requireUser();
  if ("error" in session) return session;

  const material = await getMaterial(materialId, session.user.id);
  if (!material) return { error: "Material not found." };

  if (material.fileSearchId) {
    await deleteDocumentFromStore(material.fileSearchId);
  }

  await deleteMaterial(materialId, session.user.id);
  revalidatePath(`/notebooks/${material.notebookId}`);
  return { data: { success: true, notebookId: material.notebookId } };
}
