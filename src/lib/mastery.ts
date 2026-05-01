import type { Tier } from "@/types";

const DELTAS: Record<string, number> = {
  correct: 15,
  correct_with_hint: 5,
  incorrect: -10,
  unscored: 0,
};

export const scoreDelta = (correctness: string): number => DELTAS[correctness] ?? 0;

export const clipScore = (score: number): number => Math.max(0, Math.min(100, score));

export const getMasteryTier = (score: number): Tier =>
  score <= 30 ? "recall" : score <= 60 ? "application" : "analysis";
