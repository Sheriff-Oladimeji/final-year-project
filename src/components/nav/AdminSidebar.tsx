"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ScrollText, ShieldCheck, LayoutDashboard, LogOut, BarChart3 } from "lucide-react";
import { adminAuthClient } from "@/lib/admin-auth-client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ThemeToggle } from "@/components/nav/ThemeToggle";

const links = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/insights", label: "Insights", icon: BarChart3 },
  { href: "/admin/interactions", label: "Interactions", icon: ScrollText },
];

interface AdminSidebarProps {
  userEmail: string;
}

export function AdminSidebar({ userEmail }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await adminAuthClient.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-card sticky top-0">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
          <ShieldCheck className="size-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm tracking-tight">Admin</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-0.5 p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
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
      </nav>

      {/* Footer: user + sign out */}
      <div className="shrink-0 border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-2.5 px-3 py-1.5 min-w-0">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
            {initial}
          </div>
          <span className="text-xs text-muted-foreground truncate" title={userEmail}>
            {userEmail}
          </span>
        </div>
        <ThemeToggle />
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
