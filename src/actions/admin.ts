"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { adminAuth } from "@/lib/admin-auth";
import { banUser, unbanUser, deleteUser } from "@/db/queries/users";

async function requireAdmin() {
  const session = await adminAuth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: "Unauthorised" } as const;
  }
  return null;
}

export async function disableUserAction(userId: string, reason?: string) {
  const authError = await requireAdmin();
  if (authError) return authError;

  await banUser(userId, reason);
  revalidatePath("/admin/users");
  return { data: { success: true } };
}

export async function enableUserAction(userId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;

  await unbanUser(userId);
  revalidatePath("/admin/users");
  return { data: { success: true } };
}

export async function deleteUserAction(userId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;

  await deleteUser(userId);
  revalidatePath("/admin/users");
  return { data: { success: true } };
}
