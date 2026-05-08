"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { findByEmail } from "@/db/queries/users";

export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function validateAdminEmailAction(
  email: string,
): Promise<{ valid: boolean; error?: string }> {
  const u = await findByEmail(email.trim().toLowerCase());
  if (!u) return { valid: false, error: "No account found for this email." };
  if (!u.isAdmin) return { valid: false, error: "This email is not an admin account." };
  if (u.disabledAt) return { valid: false, error: "This account has been disabled." };
  return { valid: true };
}
