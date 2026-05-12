export type UserRole = "student" | "admin";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface UserAdmin extends User {
  disabled_at: string | null;
}

export type MaterialKind = "pdf" | "youtube";
export type MaterialStatus = "pending" | "ready" | "failed";

export interface Material {
  id: string;
  user_id: string;
  kind: MaterialKind;
  display_name: string;
  source_uri: string;
  status: MaterialStatus;
  indexed_at: string | null;
  created_at: string;
  suggestions: string[];
}

export interface Citation {
  source: string;
  excerpt: string;
}

export interface AskResponse {
  guided_question: string;
  topic: string;
  interaction_id: string;
  citations: Citation[];
}

export type Correctness = "correct" | "correct_with_hint" | "incorrect";

export interface ReplyResponse {
  correctness: Correctness;
  score_delta: number;
  new_score: number;
  next_guided_question: string;
  next_interaction_id: string;
}

export type Tier = "recall" | "application" | "analysis";

export interface ScoreHistoryEntry {
  created_at: string;
  score_delta: number;
  correctness: Correctness;
}

export interface Topic {
  id: string;
  material_id: string;
  name: string;
  mastery_score: number;
  updated_at: string;
  recent_history: ScoreHistoryEntry[];
  tier: Tier;
}

export interface Interaction {
  id: string;
  question: string;
  response: string;
  student_reply: string | null;
  correctness: Correctness | "unscored";
  score_delta: number;
  prompt_template: Tier;
  created_at: string;
}

export interface InteractionAdmin {
  id: string;
  user_id: string;
  session_id: string;
  topic_id: string;
  question: string;
  response: string;
  student_reply: string | null;
  correctness: string;
  score_delta: number;
  prompt_template: string;
  created_at: string;
}
