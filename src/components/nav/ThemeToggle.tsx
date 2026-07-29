"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // next-themes resolves `undefined` until its effect runs on the client —
  // rendering the wrong icon (or throwing a hydration mismatch) for one
  // frame if this guard is skipped. Reserve the row height instead of
  // rendering nothing, so the footer doesn't jump once it resolves.
  if (!mounted) {
    return <div className="h-9" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
    >
      {isDark ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
