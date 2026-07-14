import { getClient } from "./client";
import type { UploadToFileSearchStoreOperation } from "@google/genai";

export async function createFileSearchStore(displayName: string): Promise<string> {
  const client = getClient();
  const store = await client.fileSearchStores.create({
    config: { displayName },
  });
  return store.name!;
}

export async function uploadDocumentToStore(
  storeName: string,
  content: Buffer,
  mimeType: string,
  displayName: string,
): Promise<string> {
  const client = getClient();
  const buf = content.buffer.slice(
    content.byteOffset,
    content.byteOffset + content.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buf], { type: mimeType });

  // Don't pass `mimeType` in `config` here — the Files API's request-body
  // validation for that field rejects some otherwise-valid vendor MIME
  // strings (e.g. the docx type) with a spurious 400. Setting it only on
  // the Blob still gets the correct type through via the upload header,
  // and the API accepts it there.
  let op: UploadToFileSearchStoreOperation =
    await client.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: storeName,
      file: blob,
      config: { displayName },
    });

  const deadline = Date.now() + 90_000;
  while (!op.done && Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 3_000));
    op = (await client.operations.get({
      operation: op,
    })) as UploadToFileSearchStoreOperation;
  }

  if (!op.done || op.error || !op.response?.documentName) {
    throw new Error(op.error ? JSON.stringify(op.error) : "Document upload timed out");
  }
  return op.response.documentName;
}

export async function deleteDocumentFromStore(documentName: string): Promise<void> {
  try {
    const client = getClient();
    await client.fileSearchStores.documents.delete({ name: documentName });
  } catch {
    // Don't block DB cleanup on deletion failure
  }
}

export async function deleteFileSearchStore(storeName: string): Promise<void> {
  try {
    const client = getClient();
    await client.fileSearchStores.delete({ name: storeName, config: { force: true } });
  } catch {
    // Don't block notebook deletion on store deletion failure
  }
}
