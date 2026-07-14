export type UploadableMaterialKind = "pdf" | "docx" | "txt" | "markdown";
export type MaterialKind = UploadableMaterialKind | "youtube";

export const MATERIAL_MIME_TYPES: Record<UploadableMaterialKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  markdown: "text/markdown",
};

export const MATERIAL_KIND_LABELS: Record<UploadableMaterialKind, string> = {
  pdf: "PDF",
  docx: "DOC",
  txt: "TXT",
  markdown: "MD",
};

const EXTENSION_TO_KIND: Record<string, UploadableMaterialKind> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
  ".md": "markdown",
  ".markdown": "markdown",
};

// Browsers report unreliable or empty `type` values for .md and some .docx
// files, so the extension is checked first and mime type is only a fallback.
export function detectMaterialKind(file: { name: string; type: string }): UploadableMaterialKind | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
  if (ext in EXTENSION_TO_KIND) return EXTENSION_TO_KIND[ext];

  const byMime = (Object.entries(MATERIAL_MIME_TYPES) as [UploadableMaterialKind, string][]).find(
    ([, mime]) => mime === file.type,
  );
  return byMime?.[0] ?? null;
}

export const MATERIAL_UPLOAD_ACCEPT = [
  ...Object.keys(EXTENSION_TO_KIND),
  ...Object.values(MATERIAL_MIME_TYPES),
].join(",");

export function mimeTypeForKind(kind: MaterialKind): string {
  return kind === "youtube" ? "text/plain" : MATERIAL_MIME_TYPES[kind];
}
