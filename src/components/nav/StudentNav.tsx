import Link from "next/link";
import { BookOpen, MessageSquare, Library } from "lucide-react";
import { LogoutButton } from "./LogoutButton";

export function StudentNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/dashboard" className="font-semibold text-sm tracking-tight mr-2">
          LearnAI
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BookOpen className="size-4" />
            Dashboard
          </Link>
          <Link
            href="/materials"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Library className="size-4" />
            Materials
          </Link>
          <Link
            href="/chat"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MessageSquare className="size-4" />
            Chat
          </Link>
        </div>

        <div className="ml-auto">
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}
