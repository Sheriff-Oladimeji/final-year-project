import type { FilePart } from "ai";
import { getActiveFiles } from "@/lib/gemini/files";
import type { Material } from "@/db/schema";

// Builds AI SDK FileParts for an array of materials in a notebook. Each
// material gets one FilePart. getActiveFiles handles 48h Gemini Files API
// expiry by re-uploading from local backup transparently.
export async function buildFileContentParts(materials: Material[]): Promise<FilePart[]> {
  if (materials.length === 0) return [];

  const files = await getActiveFiles(materials);
  if (files.length === 0) {
    throw new Error("None of the sources in this notebook could be loaded. Try re-uploading them.");
  }

  return files.map<FilePart>((f) => ({
    type: "file",
    data: new URL(`https://generativelanguage.googleapis.com/v1beta/${f.fileSearchId}`),
    mediaType: f.kind === "pdf" ? "application/pdf" : "text/plain",
  }));
}
