"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotebookCard } from "./NotebookCard";
import type { Notebook } from "@/types";

export interface NotebookEntry {
  notebook: Notebook;
  sourceCount: number;
  topicCount: number;
  averageMastery: number | null;
}

type View = "gallery" | "list";
const STORAGE_KEY = "learnai-notebooks-view";

export function NotebookGrid({ entries }: { entries: NotebookEntry[] }) {
  const [view, setView] = useState<View>("gallery");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "list" || saved === "gallery") setView(saved);
    setMounted(true);
  }, []);

  function switchView(v: View) {
    setView(v);
    localStorage.setItem(STORAGE_KEY, v);
  }

  return (
    <div className="space-y-5">
      {/* View toggle */}
      <div className="flex justify-end">
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => switchView("gallery")}
            title="Gallery view"
            className={
              view === "gallery"
                ? "bg-background shadow-sm text-foreground hover:bg-background"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <LayoutGrid className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => switchView("list")}
            title="List view"
            className={
              view === "list"
                ? "bg-background shadow-sm text-foreground hover:bg-background"
                : "text-muted-foreground hover:text-foreground"
            }
          >
            <Rows3 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Content — fade in after mount to avoid hydration flash */}
      <div
        className="transition-opacity duration-200"
        style={{ opacity: mounted ? 1 : 0 }}
      >
        {view === "gallery" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => (
              <NotebookCard key={e.notebook.id} {...e} view="gallery" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {entries.map((e) => (
              <NotebookCard key={e.notebook.id} {...e} view="list" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
