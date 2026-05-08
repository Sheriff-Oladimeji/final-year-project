export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { MessageSquare, BrainCircuit, Library } from "lucide-react";
import { auth } from "@/lib/auth";
import { listTopicsWithHistory } from "@/db/queries/topics";
import { TopicCard } from "@/components/dashboard/TopicCard";
import { Button } from "@/components/ui/button";
import type { Topic } from "@/types";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const rawTopics = await listTopicsWithHistory(session.user.id);
  const topics: Topic[] = rawTopics.map((t) => ({
    id: t.id,
    name: t.name,
    mastery_score: t.masteryScore,
    updated_at: t.updatedAt.toISOString(),
    tier: t.tier,
    recent_history: t.recentHistory,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your topic mastery across all course materials
          </p>
        </div>
        {topics.length > 0 && (
          <Button asChild size="sm">
            <Link href="/chat">
              <MessageSquare className="size-4" />
              Ask a question
            </Link>
          </Button>
        )}
      </div>

      {topics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-20 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <BrainCircuit className="size-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">No topics yet</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Upload materials and start a chat session — your mastery scores per topic will appear here.
              </p>
            </div>
            <Button asChild size="sm" className="mt-1">
              <Link href="/materials">
                <Library className="size-4" />
                Go to Materials
              </Link>
            </Button>
          </div>
        </div>
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
