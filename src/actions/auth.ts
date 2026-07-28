"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { adminAuth } from "@/lib/admin-auth";

export async function logoutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function adminLogoutAction() {
  await adminAuth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}
