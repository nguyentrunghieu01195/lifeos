import { describe, expect, it } from "vitest";

import { parseCategorySuggestions } from "./ai-parse";

const transactions = [
  { id: "t1", type: "EXPENSE" as const },
  { id: "t2", type: "EXPENSE" as const },
  { id: "t3", type: "INCOME" as const },
];
const categories = [
  { id: "food", type: "EXPENSE" as const },
  { id: "salary", type: "INCOME" as const },
];

describe("parseCategorySuggestions", () => {
  it("accepts valid assignments including explicit nulls", () => {
    const result = parseCategorySuggestions(
      JSON.stringify({
        assignments: [
          { transactionId: "t1", categoryId: "food" },
          { transactionId: "t2", categoryId: null },
          { transactionId: "t3", categoryId: "salary" },
        ],
      }),
      transactions,
      categories,
    );
    expect(result).toEqual({
      ok: true,
      suggestions: [
        { transactionId: "t1", categoryId: "food" },
        { transactionId: "t2", categoryId: null },
        { transactionId: "t3", categoryId: "salary" },
      ],
    });
  });

  it("tolerates code fences around the JSON", () => {
    const raw = '```json\n{"assignments":[{"transactionId":"t1","categoryId":"food"}]}\n```';
    const result = parseCategorySuggestions(raw, transactions, categories);
    expect(result.ok).toBe(true);
  });

  it("degrades hallucinated ids and cross-type picks to null", () => {
    const result = parseCategorySuggestions(
      JSON.stringify({
        assignments: [
          { transactionId: "t1", categoryId: "made-up" },
          { transactionId: "t2", categoryId: "salary" }, // income category on an expense
        ],
      }),
      transactions,
      categories,
    );
    expect(result).toEqual({
      ok: true,
      suggestions: [
        { transactionId: "t1", categoryId: null },
        { transactionId: "t2", categoryId: null },
      ],
    });
  });

  it("drops unknown transactions and duplicate entries", () => {
    const result = parseCategorySuggestions(
      JSON.stringify({
        assignments: [
          { transactionId: "ghost", categoryId: "food" },
          { transactionId: "t1", categoryId: "food" },
          { transactionId: "t1", categoryId: null },
        ],
      }),
      transactions,
      categories,
    );
    expect(result).toEqual({
      ok: true,
      suggestions: [{ transactionId: "t1", categoryId: "food" }],
    });
  });

  it("fails on malformed payloads", () => {
    expect(parseCategorySuggestions("not json", transactions, categories).ok).toBe(false);
    expect(parseCategorySuggestions('{"nope":[]}', transactions, categories).ok).toBe(false);
    expect(
      parseCategorySuggestions(
        '{"assignments":[{"transactionId":"ghost","categoryId":"food"}]}',
        transactions,
        categories,
      ).ok,
    ).toBe(false);
  });
});
