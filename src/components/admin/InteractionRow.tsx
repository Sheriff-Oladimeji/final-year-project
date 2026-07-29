"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CORRECTNESS_LABELS } from "@/lib/mastery";
import type { InteractionWithEmail } from "@/db/queries/interactions";

const CORRECTNESS_STYLES: Record<string, string> = {
  correct: "text-green-700 border-green-200 bg-green-50",
  correct_with_hint: "text-amber-700 border-amber-200 bg-amber-50",
  incorrect: "text-red-700 border-red-200 bg-red-50",
  give_up: "text-orange-700 border-orange-200 bg-orange-50",
  unscored: "text-muted-foreground",
};

export function InteractionRow({ interaction }: { interaction: InteractionWithEmail }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen(true)}>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap max-w-[160px]">
          <p className="truncate" title={interaction.userEmail}>{interaction.userEmail}</p>
        </TableCell>
        <TableCell className="text-xs max-w-[140px]">
          <p className="truncate" title={interaction.topicName}>{interaction.topicName}</p>
        </TableCell>
        <TableCell className="max-w-xs text-sm">
          <p className="truncate" title={interaction.question}>{interaction.question}</p>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn("text-xs", CORRECTNESS_STYLES[interaction.correctness] ?? "")}
          >
            {CORRECTNESS_LABELS[interaction.correctness] ?? interaction.correctness}
          </Badge>
        </TableCell>
        <TableCell className="text-sm font-mono">
          {interaction.scoreDelta > 0 ? `+${interaction.scoreDelta}` : interaction.scoreDelta}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {interaction.latencyMs != null ? `${(interaction.latencyMs / 1000).toFixed(1)}s` : "—"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {interaction.createdAt.toLocaleDateString()}
        </TableCell>
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {interaction.topicName}
              <Badge
                variant="outline"
                className={cn("text-xs capitalize", CORRECTNESS_STYLES[interaction.correctness] ?? "")}
              >
                {interaction.correctness.replace(/_/g, " ")}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>{interaction.userEmail}</span>
              <span>{interaction.createdAt.toLocaleString()}</span>
              <span>Δ score {interaction.scoreDelta > 0 ? `+${interaction.scoreDelta}` : interaction.scoreDelta}</span>
              {interaction.latencyMs != null && <span>{(interaction.latencyMs / 1000).toFixed(1)}s response time</span>}
              <span className="capitalize">{interaction.promptTemplate} template</span>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Question</p>
              <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3">{interaction.question}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Response</p>
              <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3">{interaction.response}</p>
            </div>

            {interaction.studentReply && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Student reply</p>
                <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3">{interaction.studentReply}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
