export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { listInteractionsAdmin } from "@/db/queries/interactions";
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
  const params = await searchParams;

  const rawInteractions = await listInteractionsAdmin({
    fromDate: params.from_dt ? new Date(params.from_dt) : undefined,
    toDate: params.to_dt ? new Date(params.to_dt) : undefined,
  });

  const interactions = rawInteractions
    .filter((i) => {
      if (params.correctness && i.correctness !== params.correctness) return false;
      if (params.template && i.promptTemplate !== params.template) return false;
      return true;
    })
    .map((i) => ({
      id: i.id,
      question: i.question,
      student_reply: i.studentReply,
      correctness: i.correctness,
      score_delta: i.scoreDelta,
      prompt_template: i.promptTemplate,
      created_at: i.createdAt.toISOString(),
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Interactions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Full interaction log across all students
        </p>
      </div>

      <Suspense>
        <InteractionFilters />
      </Suspense>

      {interactions.length === 0 ? (
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
              {interactions.map((i) => (
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
