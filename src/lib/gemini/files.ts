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
  const blob = new Blob([content.buffer as ArrayBuffer], { type: mimeType });
  const file = await client.files.upload({ file: blob, config: { mimeType, displayName } });
  return file.name!;
}

export async function uploadFromPath(
  localPath: string,
  mimeType: string,
  displayName: string,
): Promise<string> {
  const fs = await import("fs/promises");
  const buffer = await fs.readFile(localPath);
  return uploadBytes(buffer, mimeType, displayName);
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

export function buildFileParts(fileSearchIds: string[]): Part[] {
  return fileSearchIds.map((id) => ({
    fileData: {
      fileUri: `https://generativelanguage.googleapis.com/v1beta/${id}`,
      mimeType: "application/octet-stream",
    },
  }));
}

export async function getReadyFileIds(materials: Material[]): Promise<string[]> {
  const liveIds: string[] = [];

  for (const material of materials) {
    if (!material.fileSearchId) continue;

    let fileId = material.fileSearchId;
    const isActive = await checkFileActive(fileId);

    if (!isActive) {
      try {
        if (material.kind === "pdf" && material.localPath) {
          fileId = await uploadFromPath(material.localPath, "application/pdf", material.displayName);
        } else if (material.kind === "youtube" && material.content) {
          fileId = await uploadBytes(
            Buffer.from(material.content, "utf-8"),
            "text/plain",
            material.displayName,
          );
        } else {
          await setMaterialStatus(material.id, "failed");
          continue;
        }
        await setMaterialStatus(material.id, "ready", {
          fileSearchId: fileId,
          indexedAt: new Date(),
        });
      } catch {
        continue;
      }
    }

    liveIds.push(fileId);
  }

  return liveIds;
}
