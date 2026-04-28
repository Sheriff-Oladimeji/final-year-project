import Link from "next/link";
import { Users, ScrollText, ShieldCheck } from "lucide-react";
import { LogoutButton } from "./LogoutButton";

export function AdminNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <div className="flex items-center gap-1.5 font-semibold text-sm tracking-tight mr-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Admin
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/admin/users"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Users className="size-4" />
            Users
          </Link>
          <Link
            href="/admin/interactions"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ScrollText className="size-4" />
            Interactions
          </Link>
        </div>

        <div className="ml-auto">
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
