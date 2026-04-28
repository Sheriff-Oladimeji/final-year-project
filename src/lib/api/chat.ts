import { request } from "./client";
import type { AskResponse, ReplyResponse } from "@/types";

export const ask = (question: string) =>
  request<AskResponse>("/chat/ask", {
    method: "POST",
    body: JSON.stringify({ question }),
  });

export const reply = (
  interaction_id: string,
  studentReply: string,
  hint_requested = false,
) =>
  request<ReplyResponse>("/chat/reply", {
    method: "POST",
    body: JSON.stringify({ interaction_id, reply: studentReply, hint_requested }),
  });
