export const dynamic = "force-dynamic";

import Link from "next/link";
import { Users, Ban, FileText, MessageSquare } from "lucide-react";
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
        <Link href="/admin/users" className="rounded-xl border border-border p-5 transition-colors hover:border-primary/40 hover:bg-muted/40">
          <h2 className="text-sm font-medium">Manage students</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View accounts, ban or re-enable access, or delete a student and all their data.
          </p>
        </Link>
        <Link href="/admin/insights" className="rounded-xl border border-border p-5 transition-colors hover:border-primary/40 hover:bg-muted/40">
          <h2 className="text-sm font-medium">Insights</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Session activity, correctness distribution, and response time per student.
          </p>
        </Link>
        <Link href="/admin/interactions" className="rounded-xl border border-border p-5 transition-colors hover:border-primary/40 hover:bg-muted/40">
          <h2 className="text-sm font-medium">Review interactions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Filter the full ask-and-reply log across every student and topic.
          </p>
        </Link>
      </div>
    </div>
  );
}
