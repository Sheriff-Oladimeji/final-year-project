"use server";

import { countAdminUsers, createAdminUser, findAdminByEmail } from "@/db/queries/admin-users";

// The real security boundary lives here, not on the page. The page's
// server-side redirect is just UX — this check is what actually prevents
// a second admin account from ever being created once one exists, even if
// someone submits directly to this action (cached page, replayed request,
// or navigating straight to /admin/setup after an admin already exists).
export async function createFirstAdminAction(data: {
  name: string;
  email: string;
  password: string;
}): Promise<{ error: string } | { data: { success: true } }> {
  const existingCount = await countAdminUsers();
  if (existingCount > 0) {
    return { error: "An admin account already exists. This setup page can only be used once." } as const;
  }

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();

  if (!name) return { error: "Name is required." } as const;
  if (!email) return { error: "Email is required." } as const;
  if (data.password.length < 8) return { error: "Password must be at least 8 characters." } as const;

  const alreadyTaken = await findAdminByEmail(email);
  if (alreadyTaken) return { error: "That email is already in use." } as const;

  await createAdminUser({ name, email, password: data.password });
  return { data: { success: true } } as const;
}
