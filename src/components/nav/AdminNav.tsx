"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, ScrollText, ShieldCheck } from "lucide-react";
import { LogoutButton } from "./LogoutButton";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/interactions", label: "Interactions", icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <nav className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight mr-2">
          <ShieldCheck className="size-4 text-primary" />
          Admin
        </div>

        <div className="flex items-center gap-0.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-150",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto">
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
