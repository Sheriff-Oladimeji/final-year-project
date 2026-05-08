import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
import type { Material } from "@/db/schema";

export async function createMaterial(data: {
  userId: string;
  kind: "pdf" | "youtube";
  displayName: string;
  sourceUri: string;
  localPath?: string;
  content?: string;
}): Promise<Material> {
  const rows = await db.insert(materials).values(data).returning();
  return rows[0];
}

export async function listMaterials(userId: string): Promise<Material[]> {
  return db
    .select()
    .from(materials)
    .where(eq(materials.userId, userId))
    .orderBy(desc(materials.createdAt));
}

export async function getMaterial(id: string, userId: string): Promise<Material | null> {
  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);
  const m = rows[0];
  // Return null for missing or wrong-owner — prevents enumeration (don't leak 403)
  if (!m || m.userId !== userId) return null;
  return m;
}

export async function setMaterialStatus(
  id: string,
  status: "ready" | "failed",
  opts?: { fileSearchId?: string; indexedAt?: Date },
): Promise<void> {
  await db
    .update(materials)
    .set({ status, ...opts })
    .where(eq(materials.id, id));
}

export async function deleteMaterial(id: string, userId: string): Promise<void> {
  const m = await getMaterial(id, userId);
  if (!m) return;
  await db.delete(materials).where(eq(materials.id, id));
}

// Returns all "ready" materials for a user.
// Callers (the Gemini pipeline) are responsible for checking Gemini file expiry.
export async function getReadyMaterials(userId: string): Promise<Material[]> {
  const all = await listMaterials(userId);
  return all.filter((m) => m.status === "ready");
}

export async function getReadyMaterial(
  id: string,
  userId: string,
): Promise<Material | null> {
  const m = await getMaterial(id, userId);
  return m && m.status === "ready" ? m : null;
}
