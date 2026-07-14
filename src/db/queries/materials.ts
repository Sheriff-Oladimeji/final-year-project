import { eq, and, desc, count } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
import type { Material } from "@/db/schema";
import type { MaterialKind } from "@/lib/materials";

export const MATERIALS_PER_NOTEBOOK_CAP = 5;

export async function createMaterial(data: {
  userId: string;
  notebookId: string;
  kind: MaterialKind;
  displayName: string;
  sourceUri: string;
  localPath?: string;
  content?: string;
}): Promise<Material> {
  const rows = await db.insert(materials).values(data).returning();
  return rows[0];
}

export async function listMaterialsByNotebook(
  userId: string,
  notebookId: string,
): Promise<Material[]> {
  return db
    .select()
    .from(materials)
    .where(and(eq(materials.userId, userId), eq(materials.notebookId, notebookId)))
    .orderBy(desc(materials.createdAt));
}

export async function countMaterialsInNotebook(
  userId: string,
  notebookId: string,
): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(materials)
    .where(and(eq(materials.userId, userId), eq(materials.notebookId, notebookId)));
  return rows[0]?.n ?? 0;
}

export async function getMaterial(id: string, userId: string): Promise<Material | null> {
  const rows = await db
    .select()
    .from(materials)
    .where(eq(materials.id, id))
    .limit(1);
  const m = rows[0];
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

export async function setMaterialSuggestions(id: string, suggestions: string[]): Promise<void> {
  await db
    .update(materials)
    .set({ suggestions })
    .where(eq(materials.id, id));
}

export async function deleteMaterial(id: string, userId: string): Promise<void> {
  const m = await getMaterial(id, userId);
  if (!m) return;
  await db.delete(materials).where(eq(materials.id, id));
}

// All ready materials in a notebook — used by the chat route to build file parts.
export async function listReadyMaterialsInNotebook(
  userId: string,
  notebookId: string,
): Promise<Material[]> {
  const all = await listMaterialsByNotebook(userId, notebookId);
  return all.filter((m) => m.status === "ready");
}
