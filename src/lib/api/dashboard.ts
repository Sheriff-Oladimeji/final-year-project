import { request } from "./client";
import type { Topic, Interaction } from "@/types";

export const getTopics = () => request<Topic[]>("/dashboard/topics");

export const getTopicInteractions = (topicId: string) =>
  request<Interaction[]>(`/dashboard/topics/${topicId}/interactions`);
