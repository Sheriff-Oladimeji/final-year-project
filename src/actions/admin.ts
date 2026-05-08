"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { disableUser, deleteUser } from "@/db/queries/users";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.isAdmin) {
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
