export const dynamic = "force-dynamic";

import Link from "next/link";
import { Users, Ban, FileText, MessageSquare, BarChart3, ListFilter, ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { countStudents, countBannedStudents } from "@/db/queries/users";
import { countAllMaterials } from "@/db/queries/materials";
import { countAllInteractions } from "@/db/queries/interactions";

export default async function AdminOverviewPage() {
  const [students, banned, materials, interactions] = await Promise.all([
    countStudents(),
    countBannedStudents(),
    countAllMaterials(),
    countAllInteractions(),
  ]);

  const stats = [
    { label: "Students", value: students, icon: Users, href: "/admin/users" },
    { label: "Banned", value: banned, icon: Ban, href: "/admin/users" },
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
              <ArrowRight className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-200 group-hover/action:translate-x-0 group-hover/action:text-primary group-hover/action:opacity-100" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
