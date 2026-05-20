import type { Part } from "@google/genai";
import { getClient } from "./client";
import { setMaterialStatus } from "@/db/queries/materials";
import type { Material } from "@/db/schema";

export async function uploadBytes(
  content: Buffer,
  mimeType: string,
  displayName: string,
): Promise<string> {
  const client = getClient();
  const arrayBuffer = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const file = await client.files.upload({ file: blob, config: { mimeType, displayName } });
  return file.name!;
}

export async function checkFileActive(fileSearchId: string): Promise<boolean> {
  try {
    const client = getClient();
    const file = await client.files.get({ name: fileSearchId });
    return (file.state as string) === "ACTIVE";
  } catch {
    return false;
  }
}

export async function deleteGeminiFile(fileSearchId: string): Promise<void> {
  try {
    const client = getClient();
    await client.files.delete({ name: fileSearchId });
  } catch {
    // Deletion failure should not block DB cleanup
  }
}

export function buildFileParts(
  files: Array<{ fileSearchId: string; kind: string }>,
): Part[] {
  return files.map((f) => ({
    fileData: {
      fileUri: `https://generativelanguage.googleapis.com/v1beta/${f.fileSearchId}`,
      mimeType: f.kind === "pdf" ? "application/pdf" : "text/plain",
    },
  }));
}

export async function getActiveFiles(
  materials: Material[],
): Promise<Array<{ fileSearchId: string; kind: string }>> {
  const live: Array<{ fileSearchId: string; kind: string }> = [];

  for (const material of materials) {
    if (!material.fileSearchId) continue;

    let fileId = material.fileSearchId;
    const isActive = await checkFileActive(fileId);

    if (!isActive) {
      // PDFs have no local backup — re-upload from stored transcript for YouTube only
      try {
        if (material.kind === "youtube" && material.content) {
          fileId = await uploadBytes(
            Buffer.from(material.content, "utf-8"),
            "text/plain",
            material.displayName,
          );
          await setMaterialStatus(material.id, "ready", {
            fileSearchId: fileId,
            indexedAt: new Date(),
          });
        } else {
          // PDF with expired Gemini file — mark failed so the student knows to re-add it
          await setMaterialStatus(material.id, "failed");
          continue;
        }
      } catch {
        continue;
      }
    }

    live.push({ fileSearchId: fileId, kind: material.kind });
  }

  return live;
}
