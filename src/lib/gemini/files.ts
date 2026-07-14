import type { Part } from "@google/genai";
import { getClient } from "./client";
import { setMaterialStatus } from "@/db/queries/materials";
import type { Material } from "@/db/schema";
import { mimeTypeForKind, type MaterialKind } from "@/lib/materials";

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
  files: Array<{ fileSearchId: string; kind: MaterialKind }>,
): Part[] {
  return files.map((f) => ({
    fileData: {
      fileUri: `https://generativelanguage.googleapis.com/v1beta/${f.fileSearchId}`,
      mimeType: mimeTypeForKind(f.kind),
    },
  }));
}

// Gemini Files expire after 48h. Skip the API liveness check when indexedAt
// is within 40h — saving one round-trip per material per chat request.
const FORTY_HOURS_MS = 40 * 60 * 60 * 1000;

function isRecentlyIndexed(material: Material): boolean {
  return !!material.indexedAt && Date.now() - material.indexedAt.getTime() < FORTY_HOURS_MS;
}

export async function getActiveFiles(
  materials: Material[],
): Promise<Array<{ fileSearchId: string; kind: MaterialKind }>> {
  const results = await Promise.all(
    materials.map(async (material): Promise<{ fileSearchId: string; kind: MaterialKind } | null> => {
      if (!material.fileSearchId) return null;

      let fileId = material.fileSearchId;

      if (!isRecentlyIndexed(material)) {
        const active = await checkFileActive(fileId);
        if (!active) {
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
              await setMaterialStatus(material.id, "failed");
              return null;
            }
          } catch {
            return null;
          }
        }
      }

      return { fileSearchId: fileId, kind: material.kind as MaterialKind };
    }),
  );

  return results.filter((r): r is { fileSearchId: string; kind: MaterialKind } => r !== null);
}
