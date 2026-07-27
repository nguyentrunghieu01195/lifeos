import { describe, expect, it } from "vitest";

import { positionBetween } from "@/features/tasks/lib/position";

describe("positionBetween", () => {
  it("takes the midpoint between two neighbors", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
  });

  it("steps beyond the last item when dropped at the end", () => {
    expect(positionBetween(3000, null)).toBe(4000);
  });

  it("steps before the first item when dropped at the top", () => {
    expect(positionBetween(null, 1000)).toBe(0);
  });

  it("seeds the first position in an empty column", () => {
    expect(positionBetween(null, null)).toBe(1000);
  });

  it("keeps ordering stable across repeated midpoint inserts", () => {
    let low = 1000;
    const high = 2000;
    for (let i = 0; i < 20; i++) {
      const mid = positionBetween(low, high);
      expect(mid).toBeGreaterThan(low);
      expect(mid).toBeLessThan(high);
      low = mid;
    }
  });
});
