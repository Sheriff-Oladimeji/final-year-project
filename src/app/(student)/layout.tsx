export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { StudentNav } from "@/components/nav/StudentNav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !["student", "admin"].includes(session.user.role) || session.user.disabledAt) redirect("/");

  return (
    <div className="min-h-screen flex flex-col">
      <StudentNav />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
