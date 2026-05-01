import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import type { User } from "@/db/schema";

export async function findByGoogleSub(googleSub: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.googleSub, googleSub)).limit(1);
  return rows[0] ?? null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createStudent(data: { googleSub: string; email: string }): Promise<User> {
  const rows = await db
    .insert(users)
    .values({ googleSub: data.googleSub, email: data.email, role: "student" })
    .returning();
  return rows[0];
}

export async function createAdmin(data: { email: string; password: string }): Promise<User> {
  const passwordHash = await hashPassword(data.password);
  const rows = await db
    .insert(users)
    .values({ email: data.email, passwordHash, role: "admin" })
    .returning();
  return rows[0];
}

export async function disableUser(id: string): Promise<User> {
  const rows = await db
    .update(users)
    .set({ disabledAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return rows[0];
}

export async function deleteUser(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
  // CASCADE handles sessions, materials, topics, interactions automatically
}

export async function listAllUsers(): Promise<User[]> {
  return db.select().from(users).orderBy(users.createdAt);
}
