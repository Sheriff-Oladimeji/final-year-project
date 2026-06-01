import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import type { User } from "@/db/schema";

export async function findById(id: string): Promise<User | null> {
  const rows = await db.select().from(user).where(eq(user.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(user).where(eq(user.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function disableUser(id: string): Promise<User> {
  const rows = await db
    .update(user)
    .set({ disabledAt: new Date() })
    .where(eq(user.id, id))
    .returning();
  return rows[0];
}

export async function enableUser(id: string): Promise<User> {
  const rows = await db
    .update(user)
    .set({ disabledAt: null })
    .where(eq(user.id, id))
    .returning();
  return rows[0];
}

export async function deleteUser(id: string): Promise<void> {
  await db.delete(user).where(eq(user.id, id));
}

export async function listAllUsers(): Promise<User[]> {
  return db.select().from(user).orderBy(user.createdAt);
}
