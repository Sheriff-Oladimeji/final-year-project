"use server";

import { redirect } from "next/navigation";
import { findByEmail } from "@/db/queries/users";
import { endSession } from "@/db/queries/sessions";
import { verifyPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";

export async function adminLoginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await findByEmail(email);
  if (!user || user.role !== "admin" || !user.passwordHash) {
    return { error: "Invalid email or password." };
  }

  if (user.disabledAt) {
    return { error: "This account has been disabled." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = "admin";
  session.sessionId = "";
  session.isLoggedIn = true;
  await session.save();

  redirect("/admin/users");
}

export async function logoutAction() {
  const session = await getSession();

  if (session.isLoggedIn && session.sessionId) {
    try {
      await endSession(session.sessionId);
    } catch {
      // Session may already be gone
    }
  }

  session.destroy();
  redirect("/");
}
