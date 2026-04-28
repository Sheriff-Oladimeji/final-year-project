export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { AdminNav } from "@/components/nav/AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const user = await getMe();
    if (user.role !== "admin") redirect("/");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/");
    throw e;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
