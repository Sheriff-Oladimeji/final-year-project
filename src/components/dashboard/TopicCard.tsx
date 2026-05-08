import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkline } from "./Sparkline";
import type { Topic, Tier } from "@/types";

const TIER_STYLES: Record<Tier, { label: string; className: string }> = {
  recall:      { label: "Recall",      className: "bg-primary/10 text-primary border-primary/20" },
  application: { label: "Application", className: "bg-amber-100/80 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800" },
  analysis:    { label: "Analysis",    className: "bg-emerald-100/80 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" },
};

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  const tier = TIER_STYLES[topic.tier];

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium capitalize leading-tight line-clamp-2">
            {topic.name}
          </CardTitle>
          <Badge variant="outline" className={tier.className}>
            {tier.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-3xl font-bold tabular-nums text-primary">
            {topic.mastery_score}
          </span>
          <Sparkline history={topic.recent_history} />
        </div>
        <Progress value={topic.mastery_score} className="h-1.5" />
        <p className="text-xs text-muted-foreground">Mastery score out of 100</p>
      </CardContent>
    </Card>
  );
}
