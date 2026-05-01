"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { disableUser, deleteUser } from "@/db/queries/users";

async function requireAdmin() {
  const session = await getSession();
  if (!session.isLoggedIn || session.role !== "admin") {
    return { error: "Unauthorised" } as const;
  }
  return null;
}

export async function disableUserAction(userId: string) {
  const authError = await requireAdmin();
  if (authError) return authError;

  await disableUser(userId);
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
