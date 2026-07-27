import { describe, expect, it } from "vitest";

import { formatFullDate, greetingForHour } from "@/utils/greeting";

describe("greetingForHour", () => {
  it("maps hours to the right greeting across boundaries", () => {
    expect(greetingForHour(5)).toBe("Good morning");
    expect(greetingForHour(11)).toBe("Good morning");
    expect(greetingForHour(12)).toBe("Good afternoon");
    expect(greetingForHour(17)).toBe("Good afternoon");
    expect(greetingForHour(18)).toBe("Good evening");
    expect(greetingForHour(23)).toBe("Good evening");
    expect(greetingForHour(0)).toBe("Good evening");
    expect(greetingForHour(4)).toBe("Good evening");
  });
});

describe("formatFullDate", () => {
  it("renders a long-form date", () => {
    const formatted = formatFullDate(new Date(2026, 6, 27));
    expect(formatted).toContain("2026");
    expect(formatted).toContain("July");
    expect(formatted).toContain("Monday");
  });
});
