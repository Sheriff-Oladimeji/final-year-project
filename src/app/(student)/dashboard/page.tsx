export const dynamic = "force-dynamic";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { getTopics } from "@/lib/api/dashboard";
import { TopicCard } from "@/components/dashboard/TopicCard";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const topics = await getTopics();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your topic mastery across all course materials
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/chat">
            <MessageSquare className="size-4" />
            Ask a question
          </Link>
        </Button>
      </div>

      {topics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium">No topics yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Start asking questions in{" "}
            <Link href="/chat" className="underline underline-offset-2">
              Chat
            </Link>{" "}
            to build your mastery profile.
          </p>
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
