export const dynamic = "force-dynamic";

import Link from "next/link";
import { getStudentAnalytics } from "@/db/queries/analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CORRECTNESS_LABELS: Record<string, string> = {
  correct: "Correct",
  correct_with_hint: "Correct with hint",
  incorrect: "Incorrect",
  give_up: "Gave up",
  unscored: "Unscored (pending reply)",
};

const CORRECTNESS_ORDER = ["correct", "correct_with_hint", "incorrect", "give_up", "unscored"];

const CORRECTNESS_COLOR: Record<string, string> = {
  correct: "bg-green-500",
  correct_with_hint: "bg-amber-500",
  incorrect: "bg-red-500",
  give_up: "bg-orange-500",
  unscored: "bg-muted-foreground/40",
};

export default async function AdminInsightsPage() {
  const students = await getStudentAnalytics();

  const totalInteractions = students.reduce((sum, s) => sum + s.totalInteractions, 0);
  const activeStudents = students.length;

  const cohortCorrectness: Record<string, number> = {};
  for (const s of students) {
    for (const [label, n] of Object.entries(s.correctnessCounts)) {
      cohortCorrectness[label] = (cohortCorrectness[label] ?? 0) + n;
    }
  }

  const avgSessionsPerStudent = activeStudents > 0
    ? students.reduce((sum, s) => sum + s.sessionCount, 0) / activeStudents
    : 0;
  const avgSessionLength = activeStudents > 0
    ? students.reduce((sum, s) => sum + s.avgSessionLengthMinutes, 0) / activeStudents
    : 0;
  const avgTopicsTouched = activeStudents > 0
    ? students.reduce((sum, s) => sum + s.topicsTouched, 0) / activeStudents
    : 0;
  const latencyValues = students.map((s) => s.avgLatencyMs).filter((v): v is number => v != null);
  const avgLatencySeconds = latencyValues.length > 0
    ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length / 1000
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Insights</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Interaction-log summary across the evaluation cohort. Descriptive only —
          this sample is too small for statistical significance testing.
        </p>
      </div>

      {activeStudents === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active students</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-semibold">{activeStudents}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sessions / student</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-semibold">{avgSessionsPerStudent.toFixed(1)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg session length</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-semibold">{avgSessionLength.toFixed(0)}m</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg response time</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {avgLatencySeconds !== null ? `${avgLatencySeconds.toFixed(1)}s` : "—"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Correctness distribution</CardTitle>
              <p className="text-xs text-muted-foreground">{totalInteractions} total interactions, avg {avgTopicsTouched.toFixed(1)} topics per student</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {CORRECTNESS_ORDER.filter((label) => cohortCorrectness[label] > 0).map((label) => {
                const n = cohortCorrectness[label] ?? 0;
                const pct = totalInteractions > 0 ? (n / totalInteractions) * 100 : 0;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{CORRECTNESS_LABELS[label] ?? label}</span>
                      <span className="font-medium">{n} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CORRECTNESS_COLOR[label] ?? "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right">Interactions</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Avg session</TableHead>
                  <TableHead className="text-right">Topics</TableHead>
                  <TableHead className="text-right">Correct</TableHead>
                  <TableHead className="text-right">Gave up</TableHead>
                  <TableHead className="text-right">Avg response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const correct = (s.correctnessCounts.correct ?? 0) + (s.correctnessCounts.correct_with_hint ?? 0);
                  const gaveUp = s.correctnessCounts.give_up ?? 0;
                  return (
                    <TableRow key={s.userId}>
                      <TableCell className="font-medium text-sm">
                        <Link href={`/admin/insights/${s.userId}`} className="hover:underline underline-offset-2">
                          {s.email}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right text-sm">{s.totalInteractions}</TableCell>
                      <TableCell className="text-right text-sm">{s.sessionCount}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{s.avgSessionLengthMinutes}m</TableCell>
                      <TableCell className="text-right text-sm">{s.topicsTouched}</TableCell>
                      <TableCell className="text-right text-sm text-green-700">{correct}</TableCell>
                      <TableCell className="text-right text-sm text-orange-700">{gaveUp}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {s.avgLatencyMs != null ? `${(s.avgLatencyMs / 1000).toFixed(1)}s` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
