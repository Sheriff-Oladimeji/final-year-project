export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { StudentNav } from "@/components/nav/StudentNav";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const user = await getMe();
    if (user.role !== "student") redirect("/");
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/");
    throw e;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <StudentNav />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
