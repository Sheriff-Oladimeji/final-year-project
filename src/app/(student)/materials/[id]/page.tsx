export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getMaterial } from "@/db/queries/materials";
import { MaterialDetail } from "@/components/materials/MaterialDetail";
import type { Material } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MaterialPage({ params }: PageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const { id } = await params;
  const raw = await getMaterial(id, session.user.id);
  if (!raw) notFound();

  const material: Material = {
    id: raw.id,
    user_id: raw.userId,
    kind: raw.kind as Material["kind"],
    display_name: raw.displayName,
    source_uri: raw.sourceUri,
    status: raw.status as Material["status"],
    indexed_at: raw.indexedAt?.toISOString() ?? null,
    created_at: raw.createdAt.toISOString(),
    suggestions: raw.suggestions ?? [],
  };

  return <MaterialDetail material={material} />;
}
