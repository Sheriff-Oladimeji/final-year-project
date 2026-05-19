import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { StudentSidebar } from "@/components/nav/StudentSidebar";

export default async function WithSidebarLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="flex min-h-screen">
      <StudentSidebar isAdmin={session?.user.isAdmin ?? false} userEmail={session?.user.email ?? ""} />
      <main className="flex-1 min-w-0 px-8 py-8">{children}</main>
    </div>
  );
}
