export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { BrainCircuit, Library, MessageSquare, BookOpen } from "lucide-react";
import { auth } from "@/lib/auth";
import { listTopicsWithHistory } from "@/db/queries/topics";
import { listMaterials } from "@/db/queries/materials";
import { TopicCard } from "@/components/dashboard/TopicCard";
import { Button } from "@/components/ui/button";
import type { Topic } from "@/types";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [rawTopics, rawMaterials] = await Promise.all([
    listTopicsWithHistory(session.user.id),
    listMaterials(session.user.id),
  ]);

  const topics: Topic[] = rawTopics.map((t) => ({
    id: t.id,
    name: t.name,
    mastery_score: t.masteryScore,
    updated_at: t.updatedAt.toISOString(),
    tier: t.tier,
    recent_history: t.recentHistory,
  }));

  const readyMaterials = rawMaterials.filter((m) => m.status === "ready");

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your topic mastery across all course materials
        </p>
      </div>

      {topics.length === 0 ? (
        rawMaterials.length === 0 ? (
          /* No materials at all */
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                <Library className="size-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">No materials uploaded yet</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Upload your lecture PDFs or YouTube videos first. Gemini will index them and you can start learning.
                </p>
              </div>
              <Button asChild size="sm" className="mt-1">
                <Link href="/materials">
                  <Library className="size-4" />
                  Upload materials
                </Link>
              </Button>
            </div>
          </div>
        ) : readyMaterials.length === 0 ? (
          /* Has materials but none ready yet */
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-amber-100">
                <BookOpen className="size-7 text-amber-600" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Materials are being indexed</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Your materials are not ready yet. Once indexed you can start chatting.
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link href="/materials">
                  <Library className="size-4" />
                  Check status
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          /* Has ready materials but no topics yet (hasn't chatted) */
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                <BrainCircuit className="size-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {readyMaterials.length} material{readyMaterials.length > 1 ? "s" : ""} ready
                </p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Your materials are indexed. Go to Materials and start a chat session — your mastery scores will appear here.
                </p>
              </div>
              <Button asChild size="sm" className="mt-1">
                <Link href="/materials">
                  <MessageSquare className="size-4" />
                  Start learning
                </Link>
              </Button>
            </div>
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
