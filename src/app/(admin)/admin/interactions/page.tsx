export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { listInteractionsAdmin } from "@/db/queries/interactions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InteractionFilters } from "@/components/admin/InteractionFilters";
import { InteractionRow } from "@/components/admin/InteractionRow";
import { ExportInteractionsButton } from "@/components/admin/ExportInteractionsButton";

interface PageProps {
  searchParams: Promise<{
    correctness?: string;
    template?: string;
    from_dt?: string;
    to_dt?: string;
    user_id?: string;
  }>;
}

export default async function AdminInteractionsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const rawInteractions = await listInteractionsAdmin({
    userId: params.user_id,
    fromDate: params.from_dt ? new Date(params.from_dt) : undefined,
    toDate: params.to_dt ? new Date(params.to_dt) : undefined,
  });

  const interactions = rawInteractions.filter((i) => {
    if (params.correctness && i.correctness !== params.correctness) return false;
    if (params.template && i.promptTemplate !== params.template) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Interactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {params.user_id ? "Full interaction log for this student" : "Full interaction log across all students"}
          </p>
        </div>
        <ExportInteractionsButton interactions={interactions} />
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
                <TableHead>Student</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Correctness</TableHead>
                <TableHead>Δ Score</TableHead>
                <TableHead>Response time</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interactions.map((i) => (
                <InteractionRow key={i.id} interaction={i} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
