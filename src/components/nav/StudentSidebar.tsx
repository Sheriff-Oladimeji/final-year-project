"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Library, LogOut, BrainCircuit, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/materials", label: "Materials", icon: Library },
];

interface StudentSidebarProps {
  isAdmin: boolean;
  userEmail: string;
}

export function StudentSidebar({ isAdmin, userEmail }: StudentSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-card sticky top-0">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
          <BrainCircuit className="size-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm tracking-tight">LearnAI</span>
      </div>

      {/* Nav (scrollable when content overflows) */}
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-0.5 p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {isAdmin && (
          <div className="pt-2 mt-2 border-t border-border">
            <Link
              href="/admin/users"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <ShieldCheck className="size-4 shrink-0 text-primary" />
              Admin Panel
            </Link>
          </div>
        )}
      </nav>

      {/* Footer: user + sign out (always visible) */}
      <div className="shrink-0 border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-2.5 px-3 py-1.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
            {initial}
          </div>
          <span className="text-xs text-muted-foreground truncate" title={userEmail}>
            {userEmail}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
