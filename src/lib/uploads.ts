import fs from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export async function getUploadPath(userId: string, materialId: string): Promise<string> {
  const dir = path.join(UPLOADS_DIR, userId);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, `${materialId}.pdf`);
}

export async function saveFile(userId: string, materialId: string, buffer: Buffer): Promise<string> {
  const filePath = await getUploadPath(userId, materialId);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // File may already be gone — not an error
  }
}
