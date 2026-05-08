export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { listMaterials } from "@/db/queries/materials";
import { MaterialsPage } from "@/components/materials/MaterialsPage";
import type { Material } from "@/types";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const rawMaterials = await listMaterials(session.user.id);
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

  return <MaterialsPage initialMaterials={materials} />;
}
