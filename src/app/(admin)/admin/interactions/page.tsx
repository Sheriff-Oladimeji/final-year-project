export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { listInteractions } from "@/lib/api/admin";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InteractionFilters } from "@/components/admin/InteractionFilters";
import { cn } from "@/lib/utils";

const CORRECTNESS_STYLES: Record<string, string> = {
  correct: "text-green-700 border-green-200 bg-green-50",
  correct_with_hint: "text-amber-700 border-amber-200 bg-amber-50",
  incorrect: "text-red-700 border-red-200 bg-red-50",
  unscored: "text-muted-foreground",
};

interface PageProps {
  searchParams: Promise<{
    correctness?: string;
    template?: string;
    from_dt?: string;
    to_dt?: string;
  }>;
}

export default async function AdminInteractionsPage({ searchParams }: PageProps) {
  // Next.js 16: searchParams is a Promise
  const params = await searchParams;

  const interactions = await listInteractions({
    from_dt: params.from_dt,
    to_dt: params.to_dt,
  });

  // Client-side filtering for correctness/template (backend doesn't filter these yet)
  const filtered = interactions.filter((i) => {
    if (params.correctness && i.correctness !== params.correctness) return false;
    if (params.template && i.prompt_template !== params.template) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Interactions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Full interaction log across all students
        </p>
      </div>

      {/* Filters must be wrapped in Suspense because useSearchParams is async */}
      <Suspense>
        <InteractionFilters />
      </Suspense>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No interactions match the current filters.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Student reply</TableHead>
                <TableHead>Correctness</TableHead>
                <TableHead>Δ Score</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="max-w-xs text-sm">
                    <p className="truncate" title={i.question}>{i.question}</p>
                  </TableCell>
                  <TableCell className="max-w-xs text-sm text-muted-foreground">
                    <p className="truncate" title={i.student_reply ?? "—"}>
                      {i.student_reply ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize",
                        CORRECTNESS_STYLES[i.correctness] ?? "",
                      )}
                    >
                      {i.correctness.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {i.score_delta > 0 ? `+${i.score_delta}` : i.score_delta}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {i.prompt_template}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(i.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
