import { request, ApiError } from "./client";
import { API_BASE } from "@/lib/config";
import type { Material } from "@/types";

export const listMaterials = () => request<Material[]>("/materials/");

export async function uploadPdf(file: File): Promise<Material> {
  const form = new FormData();
  form.append("file", file);
  // No Content-Type header — browser sets it with multipart boundary automatically
  const res = await fetch(`${API_BASE}/materials/pdf`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }
  return res.json() as Promise<Material>;
}

export const submitYoutube = (url: string) =>
  request<Material>("/materials/youtube", {
    method: "POST",
    body: JSON.stringify({ url }),
  });

export const deleteMaterial = (id: string) =>
  request<void>(`/materials/${id}`, { method: "DELETE" });
