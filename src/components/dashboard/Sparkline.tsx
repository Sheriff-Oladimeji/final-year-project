"use client";

import type { ScoreHistoryEntry } from "@/types";

interface SparklineProps {
  history: ScoreHistoryEntry[];
}

export function Sparkline({ history }: SparklineProps) {
  if (history.length < 2) return null;

  const width = 80;
  const height = 24;
  const deltas = history.map((h) => h.score_delta);
  const min = Math.min(...deltas);
  const max = Math.max(...deltas);
  const range = max - min || 1;

  const points = deltas.map((d, i) => {
    const x = (i / (deltas.length - 1)) * width;
    const y = height - ((d - min) / range) * height;
    return `${x},${y}`;
  });

  const lastDelta = deltas[deltas.length - 1];
  const stroke = lastDelta > 0 ? "#22c55e" : lastDelta < 0 ? "#ef4444" : "#94a3b8";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
