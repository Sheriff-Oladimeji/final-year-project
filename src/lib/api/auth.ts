import { request } from "./client";
import type { User } from "@/types";

export const getMe = () => request<User>("/auth/me");

export const adminLogin = (email: string, password: string) =>
  request<User>("/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const logout = () =>
  request<void>("/auth/logout", { method: "POST" });
