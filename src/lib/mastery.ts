import type { Tier } from "@/types";

const DELTAS: Record<string, number> = {
  correct: 10,
  correct_with_hint: 5,
  incorrect: -10,
  give_up: -5,
  unscored: 0,
};

// "correct_with_hint" is the internal value — the classifier uses it for an
// answer that's essentially right but partial/ambiguous, not a case where a
// hint was actually given. Display copy should say "Partially correct", not
// "Correct with hint", which reads as if the student got outside help.
export const CORRECTNESS_LABELS: Record<string, string> = {
  correct: "Correct",
  correct_with_hint: "Partially correct",
  incorrect: "Incorrect",
  give_up: "Gave up",
  unscored: "Unscored",
};

export const scoreDelta = (correctness: string): number => DELTAS[correctness] ?? 0;

export const clipScore = (score: number): number => Math.max(0, Math.min(100, score));

export const getMasteryTier = (score: number): Tier =>
  score <= 30 ? "recall" : score <= 60 ? "application" : "analysis";
