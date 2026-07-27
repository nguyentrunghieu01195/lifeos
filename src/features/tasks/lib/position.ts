const GAP = 1000;

/**
 * Fractional ordering for drag-and-drop: items sort ascending by position.
 * Inserting between two items takes their midpoint; the extremes step by a
 * fixed gap. Float64 precision comfortably outlives realistic reorder counts.
 */
export function positionBetween(
  before: number | null | undefined,
  after: number | null | undefined,
): number {
  const hasBefore = typeof before === "number" && Number.isFinite(before);
  const hasAfter = typeof after === "number" && Number.isFinite(after);

  if (hasBefore && hasAfter) return (before + after) / 2;
  if (hasBefore) return before + GAP;
  if (hasAfter) return after - GAP;
  return GAP;
}
