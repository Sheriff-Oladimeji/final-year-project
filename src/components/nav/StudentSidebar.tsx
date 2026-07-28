"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, BrainCircuit, Menu, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const links = [
  { href: "/dashboard", label: "Notebooks", icon: LayoutDashboard },
];

interface StudentSidebarProps {
  userEmail: string;
}

export function StudentSidebar({ userEmail }: StudentSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  const initial = userEmail.charAt(0).toUpperCase();

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className="lg:hidden sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
        <button
          onClick={() => setOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
          <BrainCircuit className="size-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm tracking-tight">LearnAI</span>
      </div>

      {/* Backdrop (mobile only, when drawer open) */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "flex h-screen w-64 flex-col border-r border-border bg-card",
          // Mobile: fixed slide-in drawer
          "max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-72 max-lg:max-w-[85vw] max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-200",
          open ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          // Desktop: static sticky column
          "lg:sticky lg:top-0 lg:w-56 lg:shrink-0 lg:translate-x-0",
        )}
      >
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
          <BrainCircuit className="size-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm tracking-tight">LearnAI</span>
        <button
          onClick={() => setOpen(false)}
          className="lg:hidden ml-auto flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Nav (scrollable when content overflows) */}
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-0.5 p-3">
        {links.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(href + "/") ||
            (href === "/dashboard" && pathname.startsWith("/notebooks/"));
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
    </>
  );
}
