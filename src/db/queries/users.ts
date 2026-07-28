import { count, eq } from "drizzle-orm";
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

// Ban enforcement at sign-in is automatic — it comes from Better Auth's
// `admin` plugin (registered in src/lib/auth.ts), which checks the banned
// column on every session creation regardless of who wrote it. These
// functions write directly via Drizzle rather than through the plugin's own
// HTTP endpoints, since the caller here is an admin authenticated against a
// completely separate Better Auth instance (src/lib/admin-auth.ts).
export async function banUser(id: string, reason?: string): Promise<User> {
  const rows = await db
    .update(user)
    .set({ banned: true, banReason: reason ?? null, banExpires: null })
    .where(eq(user.id, id))
    .returning();
  return rows[0];
}

export async function unbanUser(id: string): Promise<User> {
  const rows = await db
    .update(user)
    .set({ banned: false, banReason: null, banExpires: null })
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

export async function countStudents(): Promise<number> {
  const rows = await db.select({ value: count() }).from(user);
  return rows[0]?.value ?? 0;
}

export async function countBannedStudents(): Promise<number> {
  const rows = await db.select({ value: count() }).from(user).where(eq(user.banned, true));
  return rows[0]?.value ?? 0;
}
