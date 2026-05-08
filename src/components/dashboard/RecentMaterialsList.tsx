import Link from "next/link";
import { FileText, Video, ChevronRight, Loader2, CheckCircle, XCircle } from "lucide-react";
import type { Material } from "@/types";
import { cn } from "@/lib/utils";

interface RecentMaterialsListProps {
  materials: Material[];
  limit?: number;
}

export function RecentMaterialsList({ materials, limit = 5 }: RecentMaterialsListProps) {
  const visible = materials.slice(0, limit);
  const more = materials.length - visible.length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Recent materials
        </p>
        <Link href="/materials" className="text-xs text-muted-foreground hover:text-primary transition-colors">
          View all →
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-muted-foreground">No materials yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((m) => (
            <li key={m.id}>
              <Link
                href={`/materials/${m.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
              >
                <div
                  className={cn(
                    "flex-shrink-0 transition-colors",
                    m.status === "ready"
                      ? "text-primary/70 group-hover:text-primary"
                      : "text-muted-foreground/60",
                  )}
                >
                  {m.kind === "pdf" ? <FileText className="size-4" /> : <Video className="size-4" />}
                </div>
                <p className="flex-1 min-w-0 text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {m.display_name}
                </p>
                <StatusIcon status={m.status} />
                <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {more > 0 && (
        <div className="px-4 py-2 border-t border-border">
          <Link
            href="/materials"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            +{more} more →
          </Link>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Material["status"] }) {
  if (status === "pending") {
    return <Loader2 className="size-3.5 text-muted-foreground animate-spin shrink-0" aria-label="Indexing" />;
  }
  if (status === "ready") {
    return <CheckCircle className="size-3.5 text-emerald-600 shrink-0" aria-label="Ready" />;
  }
  return <XCircle className="size-3.5 text-destructive shrink-0" aria-label="Failed" />;
}
