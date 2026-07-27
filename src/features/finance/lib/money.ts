/**
 * Money helpers. Amounts are integer minor units (VND đồng) end to end —
 * floats never touch arithmetic. This phase is single-currency; the format
 * lives here so a future multi-currency pass changes exactly one module.
 */

/** 10 nghìn tỷ đồng — sanity ceiling for a personal ledger entry. */
export const MAX_AMOUNT_MINOR = 10_000_000_000_000;

const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("vi-VN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatMoney(amountMinor: number): string {
  return vndFormatter.format(amountMinor);
}

/** Short form for chart axes: 1.500.000 → "1,5 Tr". */
export function formatMoneyCompact(amountMinor: number): string {
  return `${compactFormatter.format(amountMinor)} ₫`;
}

/**
 * Parse human input into minor units: accepts "1500000", "1.500.000",
 * "1,500,000" and "1 500 000". Returns null for anything else.
 */
export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/[\s.,]/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_AMOUNT_MINOR) return null;
  return value;
}

/** BigInt (Prisma) → number DTO with an explicit safety guard. */
export function toAmountNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount exceeds the safe integer range.");
  }
  return Number(value);
}

// --- Month keys ("YYYY-MM", timezone-proof by construction) -----------------

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string): boolean {
  return MONTH_KEY_PATTERN.test(value);
}

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Month arithmetic on keys — no Date timezone traps. */
export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const index = year! * 12 + (month! - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

/** UTC range [start, end) covering one month key — for occurredAt queries. */
export function monthRangeUtc(monthKey: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year!, month! - 1, 1)),
    end: new Date(Date.UTC(year!, month!, 1)),
  };
}

/** "2026-07" → "Jul 2026" for headers (locale-independent, tz-independent). */
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}

/** Date-only string "YYYY-MM-DD" → Date at UTC midnight (storage form). */
export function dateStringToUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Storage Date → "YYYY-MM-DD" (display/DTO form). */
export function utcToDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function todayDateString(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
}
