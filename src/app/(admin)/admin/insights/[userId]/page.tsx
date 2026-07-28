export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target, Zap, Brain } from "lucide-react";
import { findById } from "@/db/queries/users";
import { listTopicsWithHistory } from "@/db/queries/topics";
import { getStudentAnalytics } from "@/db/queries/analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tier } from "@/types";

const TIER_META: Record<Tier, { label: string; range: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  recall: { label: "Recall", range: "0–30", icon: Target, className: "bg-primary/10 text-primary border-primary/20" },
  application: { label: "Application", range: "31–60", icon: Zap, className: "bg-amber-100/80 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
  analysis: { label: "Analysis", range: "61–100", icon: Brain, className: "bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
};

export default async function StudentInsightsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const [student, topicHistory, cohort] = await Promise.all([
    findById(userId),
    listTopicsWithHistory(userId),
    getStudentAnalytics(),
  ]);

  if (!student) notFound();

  const stats = cohort.find((s) => s.userId === userId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/insights" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Back to insights
        </Link>
        <h1 className="text-xl font-semibold mt-2">{student.email}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Joined {student.createdAt.toLocaleDateString()}
          {student.banned && <span className="text-red-600"> · Banned</span>}
        </p>
      </div>

      {stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Interactions</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{stats.totalInteractions}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sessions</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{stats.sessionCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg session</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{stats.avgSessionLengthMinutes}m</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg response</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {stats.avgLatencyMs != null ? `${(stats.avgLatencyMs / 1000).toFixed(1)}s` : "—"}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border py-8 text-center">
          <p className="text-sm text-muted-foreground">No interactions logged yet.</p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Mastery by topic</h2>
          <Link href={`/admin/interactions?user_id=${userId}`} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            View full interaction log →
          </Link>
        </div>

        {topicHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">No topics yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topicHistory.map((topic) => {
              const tierMeta = TIER_META[topic.tier];
              const TierIcon = tierMeta.icon;
              // Oldest first, so the trajectory reads left-to-right in time order.
              const history = [...topic.recentHistory].reverse();

              return (
                <Card key={topic.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{topic.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Score {topic.masteryScore}/100 · Updated {topic.updatedAt.toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("gap-1 text-xs", tierMeta.className)}>
                        <TierIcon className="size-3" />
                        {tierMeta.label} ({tierMeta.range})
                      </Badge>
                    </div>

                    {history.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1">
                        <span className="text-xs text-muted-foreground mr-1">Recent:</span>
                        {history.map((h, i) => (
                          <span
                            key={i}
                            title={`${h.correctness.replace(/_/g, " ")} · ${new Date(h.created_at).toLocaleDateString()}`}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-xs font-mono",
                              h.score_delta > 0
                                ? "bg-green-50 text-green-700"
                                : h.score_delta < 0
                                  ? "bg-red-50 text-red-700"
                                  : "bg-muted text-muted-foreground",
                            )}
                          >
                            {h.score_delta > 0 ? `+${h.score_delta}` : h.score_delta}
                          </span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
