export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Library, BookOpen, BrainCircuit, FileText, Video } from "lucide-react";
import { auth } from "@/lib/auth";
import { listTopicsWithHistory } from "@/db/queries/topics";
import { listMaterials } from "@/db/queries/materials";
import { TopicCard } from "@/components/dashboard/TopicCard";
import { RecentMaterialsList } from "@/components/dashboard/RecentMaterialsList";
import { AddMaterialDialog } from "@/components/materials/AddMaterialDialog";
import type { Topic, Material } from "@/types";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [rawTopics, rawMaterials] = await Promise.all([
    listTopicsWithHistory(session.user.id),
    listMaterials(session.user.id),
  ]);

  const topics: Topic[] = rawTopics.map((t) => ({
    id: t.id,
    material_id: t.materialId,
    name: t.name,
    mastery_score: t.masteryScore,
    updated_at: t.updatedAt.toISOString(),
    tier: t.tier,
    recent_history: t.recentHistory,
  }));

  const materials: Material[] = rawMaterials.map((m) => ({
    id: m.id,
    user_id: m.userId,
    kind: m.kind as Material["kind"],
    display_name: m.displayName,
    source_uri: m.sourceUri,
    status: m.status as Material["status"],
    indexed_at: m.indexedAt?.toISOString() ?? null,
    created_at: m.createdAt.toISOString(),
    suggestions: m.suggestions ?? [],
  }));

  const readyMaterials = materials.filter((m) => m.status === "ready");
  const hasMaterials = materials.length > 0;
  const hasReady = readyMaterials.length > 0;
  const hasTopics = topics.length > 0;

  // Group topics by material so each material gets its own card section.
  const topicsByMaterial = new Map<string, Topic[]>();
  for (const t of topics) {
    const list = topicsByMaterial.get(t.material_id) ?? [];
    list.push(t);
    topicsByMaterial.set(t.material_id, list);
  }
  // Order: materials that have topics first (most recently updated), then by createdAt.
  const groupedMaterials = materials
    .filter((m) => topicsByMaterial.has(m.id))
    .sort((a, b) => {
      const at = topicsByMaterial.get(a.id) ?? [];
      const bt = topicsByMaterial.get(b.id) ?? [];
      const aLatest = Math.max(...at.map((t) => new Date(t.updated_at).getTime()));
      const bLatest = Math.max(...bt.map((t) => new Date(t.updated_at).getTime()));
      return bLatest - aLatest;
    });

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your topic mastery, grouped by material
          </p>
        </div>
        <AddMaterialDialog />
      </div>

      {!hasMaterials ? (
        <EmptyState
          icon={<Library className="size-7 text-primary" />}
          iconBg="bg-primary/10"
          title="No materials yet"
          body="Add your first PDF or YouTube video. Gemini will index it and you can begin learning."
          action={<AddMaterialDialog />}
        />
      ) : !hasReady ? (
        <EmptyState
          icon={<BookOpen className="size-7 text-amber-600" />}
          iconBg="bg-amber-100"
          title="Materials are being indexed"
          body="Hold tight — your materials are still being processed. Refresh in a moment."
        />
      ) : !hasTopics ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                <BrainCircuit className="size-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Ready to start</p>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                  Open a material on the right to start a chat. Your mastery scores will appear here.
                </p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <RecentMaterialsList materials={readyMaterials} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            {groupedMaterials.map((material) => {
              const materialTopics = topicsByMaterial.get(material.id) ?? [];
              return (
                <section key={material.id}>
                  <Link
                    href={`/materials/${material.id}`}
                    className="group flex items-center gap-2 mb-3 hover:text-primary transition-colors"
                  >
                    <div className="text-primary/70 group-hover:text-primary">
                      {material.kind === "pdf" ? (
                        <FileText className="size-4" />
                      ) : (
                        <Video className="size-4" />
                      )}
                    </div>
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors truncate">
                      {material.display_name}
                    </h2>
                  </Link>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {materialTopics.map((topic) => (
                      <TopicCard key={topic.id} topic={topic} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="lg:col-span-1">
            <RecentMaterialsList materials={materials} />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  iconBg,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border py-20 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className={`flex size-14 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">{body}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
