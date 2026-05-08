import type { FilePart } from "ai";
import { getActiveFiles } from "@/lib/gemini/files";
import type { Material } from "@/db/schema";

// Builds AI SDK FileParts for a material's uploaded Gemini file. Auto-refreshes
// the upload if it has expired (48h Gemini Files API TTL).
export async function buildFileContentParts(material: Material): Promise<FilePart[]> {
  const files = await getActiveFiles([material]);
  if (files.length === 0) {
    throw new Error("This material could not be loaded. Try re-uploading it.");
  }

  return files.map<FilePart>((f) => ({
    type: "file",
    data: new URL(`https://generativelanguage.googleapis.com/v1beta/${f.fileSearchId}`),
    mediaType: f.kind === "pdf" ? "application/pdf" : "text/plain",
  }));
}
