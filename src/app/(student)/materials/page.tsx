export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listMaterials } from "@/db/queries/materials";
import { MaterialsPage } from "@/components/materials/MaterialsPage";
import type { Material } from "@/types";

export default async function Page() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/");

  const rawMaterials = await listMaterials(session.userId);

  const materials: Material[] = rawMaterials.map((m) => ({
    id: m.id,
    user_id: m.userId,
    kind: m.kind as Material["kind"],
    display_name: m.displayName,
    source_uri: m.sourceUri,
    status: m.status as Material["status"],
    indexed_at: m.indexedAt?.toISOString() ?? null,
    created_at: m.createdAt.toISOString(),
  }));

  return <MaterialsPage initialMaterials={materials} />;
}
