"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InteractionWithEmail } from "@/db/queries/interactions";

const COLUMNS: { key: keyof InteractionWithEmail | "createdAt"; label: string }[] = [
  { key: "userEmail", label: "Student" },
  { key: "topicName", label: "Topic" },
  { key: "promptTemplate", label: "Template" },
  { key: "question", label: "Question" },
  { key: "response", label: "Response" },
  { key: "studentReply", label: "Student reply" },
  { key: "correctness", label: "Correctness" },
  { key: "scoreDelta", label: "Score delta" },
  { key: "latencyMs", label: "Response time (ms)" },
  { key: "createdAt", label: "Date" },
];

// RFC 4180: wrap every field in quotes, double any internal quotes. Question,
// response, and student reply are all free text a student fully controls —
// neutralize leading formula-trigger characters so Excel/Sheets doesn't
// interpret a cell as a formula when this is opened (CSV/formula injection).
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function buildCsv(interactions: InteractionWithEmail[]): string {
  const header = COLUMNS.map((c) => csvCell(c.label)).join(",");
  const rows = interactions.map((i) =>
    COLUMNS.map((c) => csvCell(i[c.key as keyof InteractionWithEmail])).join(","),
  );
  return [header, ...rows].join("\r\n");
}

export function ExportInteractionsButton({ interactions }: { interactions: InteractionWithEmail[] }) {
  function handleExport() {
    const csv = buildCsv(interactions);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `interactions-${stamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={interactions.length === 0}>
      <Download className="size-3.5" />
      Export CSV
    </Button>
  );
}
