export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/nav/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !session.user.isAdmin) redirect("/");

  return (
    <div className="flex min-h-screen">
      <AdminSidebar userEmail={session.user.email} />
      <main className="flex-1 min-w-0 px-8 py-8">{children}</main>
    </div>
  );
}
