export const dynamic = "force-dynamic";

import Link from "next/link";
import { Users, BookOpen, FileText, MessageSquare, BarChart3, ListFilter, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CORRECTNESS_LABELS } from "@/lib/mastery";
import { countStudents } from "@/db/queries/users";
import { countAllNotebooks } from "@/db/queries/notebooks";
import { countAllMaterials } from "@/db/queries/materials";
import { countAllInteractions, listInteractionsAdmin } from "@/db/queries/interactions";
import { cn } from "@/lib/utils";

const CORRECTNESS_STYLES: Record<string, string> = {
  correct: "text-green-700 border-green-200 bg-green-50",
  correct_with_hint: "text-amber-700 border-amber-200 bg-amber-50",
  incorrect: "text-red-700 border-red-200 bg-red-50",
  give_up: "text-orange-700 border-orange-200 bg-orange-50",
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function AdminOverviewPage() {
  const [students, notebooks, materials, interactions, recentRaw] = await Promise.all([
    countStudents(),
    countAllNotebooks(),
    countAllMaterials(),
    countAllInteractions(),
    // Over-fetch and filter client-side rather than adding a query-level
    // exclusion — "unscored"/"completed" aren't outcomes (see Insights page),
    // so recent activity should only ever surface graded interactions.
    listInteractionsAdmin({ limit: 20 }),
  ]);
  const recentActivity = recentRaw
    .filter((i) => i.correctness !== "unscored" && i.correctness !== "completed")
    .slice(0, 6);

  const stats = [
    { label: "Students", value: students, icon: Users, href: "/admin/users" },
    { label: "Notebooks", value: notebooks, icon: BookOpen, href: null },
    { label: "Materials indexed", value: materials, icon: FileText, href: null },
    { label: "Interactions logged", value: interactions, icon: MessageSquare, href: "/admin/interactions" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Snapshot of the evaluation cohort and system activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => {
          const card = (
            <Card className="transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{value}</div>
              </CardContent>
            </Card>
          );
          return href ? (
            <Link key={label} href={href}>
              {card}
            </Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            href: "/admin/users",
            icon: Users,
            title: "Manage students",
            description: "View accounts, ban or re-enable access, or delete a student and all their data.",
          },
          {
            href: "/admin/insights",
            icon: BarChart3,
            title: "Insights",
            description: "Session activity, correctness distribution, and response time per student.",
          },
          {
            href: "/admin/interactions",
            icon: ListFilter,
            title: "Review interactions",
            description: "Filter the full ask-and-reply log across every student and topic.",
          },
        ].map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group/action flex cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted transition-colors group-hover/action:border-primary/30 group-hover/action:bg-primary/10">
                <Icon className="size-4 text-foreground transition-colors group-hover/action:text-primary" strokeWidth={1.75} />
              </span>
              <ArrowRight className="size-4 text-muted-foreground/50 transition-all duration-200 group-hover/action:translate-x-0.5 group-hover/action:text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>

      {recentActivity.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-medium">Recent activity</h2>
            <Link
              href="/admin/interactions"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              View full log &rarr;
            </Link>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    <span className="text-muted-foreground">{i.userEmail}</span>{" "}
                    <span className="text-muted-foreground/60">&middot;</span>{" "}
                    <span className="capitalize">{i.topicName}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{i.question}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant="outline" className={cn("text-xs", CORRECTNESS_STYLES[i.correctness] ?? "")}>
                    {CORRECTNESS_LABELS[i.correctness] ?? i.correctness}
                  </Badge>
                  <span className="w-14 text-right text-xs text-muted-foreground">{timeAgo(i.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
