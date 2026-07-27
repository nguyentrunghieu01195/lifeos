"use client";

import { buildHeatmap, buildMiniHeatmap } from "../lib/streak";

interface HabitHeatmapProps {
  completedDates: string[];
  today: string;
  color: string;
}

/** Full 52-week GitHub-style heatmap. */
export function HabitHeatmap({ completedDates, today, color }: HabitHeatmapProps) {
  const cells = buildHeatmap(completedDates, today, 365);

  return (
    <div
      aria-label="Activity heatmap"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(53, 1fr)",
        gridAutoRows: "14px",
        gap: "3px",
      }}
    >
      {cells.map((cell) => (
        <div
          key={cell.date}
          title={cell.date}
          aria-label={`${cell.date}: ${cell.completed ? "completed" : "missed"}`}
          className="rounded-sm"
          style={{
            backgroundColor: cell.completed ? color : "var(--color-muted)",
            opacity: cell.completed ? 0.85 : 0.4,
          }}
        />
      ))}
    </div>
  );
}

interface MiniHeatmapProps {
  completedDates: string[];
  today: string;
  color: string;
}

/** 14-day dots shown on each habit card. */
export function MiniHeatmap({ completedDates, today, color }: MiniHeatmapProps) {
  const cells = buildMiniHeatmap(completedDates, today);

  return (
    <div className="flex items-center gap-0.5" aria-label="14-day activity">
      {cells.map((cell) => (
        <div
          key={cell.date}
          className="size-2 rounded-sm"
          title={cell.date}
          style={{
            backgroundColor: cell.completed ? color : "var(--color-muted)",
            opacity: cell.completed ? 0.85 : 0.4,
          }}
        />
      ))}
    </div>
  );
}
