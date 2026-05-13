import Link from "next/link";
import { Book, FileText, Brain } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Notebook } from "@/types";

interface NotebookCardProps {
  notebook: Notebook;
  sourceCount: number;
  topicCount: number;
  averageMastery: number | null;
}

export function NotebookCard({
  notebook,
  sourceCount,
  topicCount,
  averageMastery,
}: NotebookCardProps) {
  return (
    <Link href={`/notebooks/${notebook.id}`} className="block group">
      <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all duration-200">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
              <Book className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {notebook.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Updated {timeAgo(notebook.updated_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FileText className="size-3.5" />
              {sourceCount} source{sourceCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Brain className="size-3.5" />
              {topicCount} topic{topicCount === 1 ? "" : "s"}
            </span>
          </div>

          {averageMastery !== null && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/20 text-xs tabular-nums"
              >
                {averageMastery} / 100
              </Badge>
              <span className="text-xs text-muted-foreground">avg mastery</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
