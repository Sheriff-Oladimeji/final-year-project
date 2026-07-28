import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminUser, adminAccount } from "@/db/schema";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";

export async function countAdminUsers(): Promise<number> {
  const rows = await db.select({ n: count() }).from(adminUser);
  return rows[0]?.n ?? 0;
}

// Writes directly via Drizzle (same shape Better Auth's own sign-up route
// uses: providerId "credential", accountId === the new user's id) rather
// than going through adminAuth.api.signUpEmail, so the caller controls
// exactly when the account is created relative to the "only one admin
// ever" check in createFirstAdminAction.
export async function createAdminUser(data: {
  name: string;
  email: string;
  password: string;
}): Promise<{ id: string }> {
  const now = new Date();
  const userId = randomUUID();
  const passwordHash = await hashPassword(data.password);

  await db.insert(adminUser).values({
    id: userId,
    name: data.name,
    email: data.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(adminAccount).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  return { id: userId };
}

export async function findAdminByEmail(email: string) {
  const rows = await db.select().from(adminUser).where(eq(adminUser.email, email)).limit(1);
  return rows[0] ?? null;
}
