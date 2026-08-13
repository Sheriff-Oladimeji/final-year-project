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
  listMaterialsByNotebook,
  MATERIALS_PER_NOTEBOOK_CAP,
} from "@/db/queries/materials";
import { getNotebook, touchNotebook, setNotebookSummary, claimNotebookSummarySlot } from "@/db/queries/notebooks";
import { fetchTranscript } from "@/lib/youtube";
import { uploadDocumentToStore, deleteDocumentFromStore } from "@/lib/gemini/fileSearch";
import { generateMaterialSuggestions, generateNotebookSummary } from "@/lib/ai/suggestions";
import { regenerateTopicTaxonomy } from "@/lib/ai/topic-taxonomy";
import { detectMaterialKind, mimeTypeForKind } from "@/lib/materials";

async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.banned) {
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

// Generates once per notebook, not on every source add — this runs inside
// every material's after() background task, and uploading several files at
// once (multi-upload) fires several of these concurrently. Re-running it per
// upload multiplied DB/Gemini load enough to exhaust Neon's connection pool
// during a batch upload (observed 2026-08-11). claimNotebookSummarySlot is
// an atomic conditional UPDATE — only the first of several concurrent
// callers wins it, the rest return false immediately with no extra query
// or Gemini call. A slightly stale summary after adding a 2nd/3rd source is
// an acceptable tradeoff for avoiding that load spike.
//
// Topic taxonomy extraction is fully independent of this — see
// regenerateTopicTaxonomy below — and does NOT share this one-shot
// limitation; it re-runs on every new material.
async function regenerateNotebookSummary(notebookId: string, userId: string) {
  const claimed = await claimNotebookSummarySlot(notebookId, userId);
  if (!claimed) return;

  const nb = await getNotebook(notebookId, userId);
  if (!nb) return;
  const summary = await generateNotebookSummary(notebookId, nb.title);
  if (summary) {
    await setNotebookSummary(notebookId, userId, summary);
  }
}

// regenerateTopicTaxonomy lives in src/lib/ai/topic-taxonomy.ts, not here —
// see that file's top comment for why it can't be defined in a "use server"
// module.

export async function uploadMaterialAction(formData: FormData) {
  const session = await requireUser();
  if ("error" in session) return session;

  const notebookId = formData.get("notebookId") as string | null;
  if (!notebookId) return { error: "Missing notebook." };
  const capCheck = await checkCanAddMaterial(session.user.id, notebookId);
  if (capCheck) return capCheck;

  const file = formData.get("file") as File | null;
  if (!file) return { error: "Please choose a file to upload." };
  const kind = detectMaterialKind(file);
  if (!kind) {
    return { error: "Please upload a PDF, DOCX, TXT, or Markdown file." };
  }

  const existingMaterials = await listMaterialsByNotebook(session.user.id, notebookId);
  const isDuplicate = existingMaterials.some(
    (m) => m.displayName.trim().toLowerCase() === file.name.trim().toLowerCase(),
  );
  if (isDuplicate) {
    return { error: `"${file.name}" is already in this notebook. Rename the file or remove the existing one first.` };
  }

  const nb = await getNotebook(notebookId, session.user.id);
  const storeName = nb!.fileSearchStoreName!;

  const material = await createMaterial({
    userId: session.user.id,
    notebookId,
    kind,
    displayName: file.name,
    sourceUri: file.name,
  });

  revalidatePath(`/notebooks/${notebookId}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  const materialId = material.id;
  const userId = session.user.id;
  const fileName = file.name;

  after(async () => {
    try {
      const documentName = await uploadDocumentToStore(storeName, buffer, mimeTypeForKind(kind), fileName);
      await setMaterialStatus(materialId, "ready", { fileSearchId: documentName, indexedAt: new Date() });
      await touchNotebook(notebookId, userId);
      await persistSuggestions(materialId, userId);
      await regenerateNotebookSummary(notebookId, userId);
      // Own try/catch, deliberately not left to the outer one: the material
      // above is already committed "ready" and genuinely indexed at this
      // point. A transient failure here (e.g. a DB hiccup under batch-upload
      // load) must not fall through to the outer catch and flip this
      // material back to "failed" — that would hide a working, indexed
      // material from the student over an unrelated taxonomy error.
      try {
        await regenerateTopicTaxonomy(notebookId, userId);
      } catch (err) {
        console.error("[regenerateTopicTaxonomy] failed, material stays ready:", err);
      }
    } catch (err) {
      console.error("[uploadMaterialAction] after() failed:", err);
      await setMaterialStatus(materialId, "failed");
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
      await regenerateNotebookSummary(notebookId, userId);
      // Own try/catch, deliberately not left to the outer one: the material
      // above is already committed "ready" and genuinely indexed at this
      // point. A transient failure here (e.g. a DB hiccup under batch-upload
      // load) must not fall through to the outer catch and flip this
      // material back to "failed" — that would hide a working, indexed
      // material from the student over an unrelated taxonomy error.
      try {
        await regenerateTopicTaxonomy(notebookId, userId);
      } catch (err) {
        console.error("[regenerateTopicTaxonomy] failed, material stays ready:", err);
      }
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
