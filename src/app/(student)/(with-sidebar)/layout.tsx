import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { StudentSidebar } from "@/components/nav/StudentSidebar";

export default async function WithSidebarLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <StudentSidebar userEmail={session?.user.email ?? ""} />
      <main className="flex-1 min-w-0 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
