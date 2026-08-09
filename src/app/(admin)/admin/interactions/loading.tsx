import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function InteractionsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Interactions</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Loading the interaction log…</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>

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
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
