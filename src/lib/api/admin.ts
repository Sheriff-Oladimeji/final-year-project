import { request } from "./client";
import type { UserAdmin, InteractionAdmin } from "@/types";

export const listUsers = (skip = 0, limit = 50) =>
  request<UserAdmin[]>(`/admin/users?skip=${skip}&limit=${limit}`);

export const disableUser = (id: string) =>
  request<UserAdmin>(`/admin/users/${id}/disable`, { method: "POST" });

export const deleteUser = (id: string) =>
  request<void>(`/admin/users/${id}`, { method: "DELETE" });

export function listInteractions(params: {
  user_id?: string;
  topic_id?: string;
  from_dt?: string;
  to_dt?: string;
  skip?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return request<InteractionAdmin[]>(`/admin/interactions?${qs}`);
}
