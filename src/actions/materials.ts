"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createMaterial, deleteMaterial, setMaterialStatus, getMaterial } from "@/db/queries/materials";
import { saveFile, deleteFile } from "@/lib/uploads";
import { fetchTranscript } from "@/lib/youtube";
import { uploadBytes, uploadFromPath, deleteGeminiFile } from "@/lib/gemini/files";

async function requireStudent() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "student" || session.user.disabledAt) {
    return { error: "Unauthorised" } as const;
  }
  return session;
}

export async function uploadPdfAction(formData: FormData) {
  const session = await requireStudent();
  if ("error" in session) return session;

  const file = formData.get("file") as File | null;
  if (!file || file.type !== "application/pdf") {
    return { error: "Please upload a valid PDF file." };
  }

  const material = await createMaterial({
    userId: session.user.id,
    kind: "pdf",
    displayName: file.name,
    sourceUri: file.name,
  });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const localPath = await saveFile(session.user.id, material.id, buffer);
    const fileSearchId = await uploadFromPath(localPath, "application/pdf", file.name);

    await setMaterialStatus(material.id, "ready", { fileSearchId, indexedAt: new Date() });
    revalidatePath("/materials");
    return { data: { id: material.id, status: "ready" } };
  } catch (err: unknown) {
    await setMaterialStatus(material.id, "failed");
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function submitYoutubeAction(formData: FormData) {
  const session = await requireStudent();
  if ("error" in session) return session;

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
    revalidatePath("/materials");
    return { data: { id: material.id, status: "ready" } };
  } catch (err: unknown) {
    await setMaterialStatus(material.id, "failed");
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function deleteMaterialAction(materialId: string) {
  const session = await requireStudent();
  if ("error" in session) return session;

  const material = await getMaterial(materialId, session.user.id);
  if (!material) return { error: "Material not found." };

  if (material.fileSearchId) await deleteGeminiFile(material.fileSearchId);
  if (material.localPath) await deleteFile(material.localPath);

  await deleteMaterial(materialId, session.user.id);
  revalidatePath("/materials");
  return { data: { success: true } };
}
