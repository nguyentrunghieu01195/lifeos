import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";

import {
  applyCategoryAssignments,
  createCategory,
  createStarterCategories,
  createTransaction,
  deleteTransaction,
  getMonthOverview,
  listBudgets,
  listTransactions,
  listUncategorized,
  setBudget,
  updateTransaction,
} from "./service";

const hasDatabase = Boolean(process.env.DATABASE_URL);

let userA = "";
let userB = "";
let food = "";
let salary = "";

const MONTH = "2031-05"; // far-future month keeps these rows isolated from other tests

describe.runIf(hasDatabase)("finance service (integration)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a, b] = await Promise.all([
      db.user.create({ data: { email: `itest-fin-a-${crypto.randomUUID()}@lifeos.test` } }),
      db.user.create({ data: { email: `itest-fin-b-${crypto.randomUUID()}@lifeos.test` } }),
    ]);
    userA = a.id;
    userB = b.id;
    food = (await createCategory(userA, { name: "Food", type: "EXPENSE" })).id;
    salary = (await createCategory(userA, { name: "Salary", type: "INCOME" })).id;
  });

  afterAll(async () => {
    await getDb().user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("creates transactions with date-only UTC semantics", async () => {
    const transaction = await createTransaction(userA, {
      type: "EXPENSE",
      amountMinor: 55_000,
      note: "ăn trưa",
      date: `${MONTH}-15`,
      categoryId: food,
    });
    expect(transaction.date).toBe(`${MONTH}-15`);
    expect(transaction.amountMinor).toBe(55_000);
    expect(transaction.category?.id).toBe(food);

    const list = await listTransactions(userA, MONTH);
    expect(list.some((row) => row.id === transaction.id)).toBe(true);
    // Neighboring months never see it.
    expect(
      (await listTransactions(userA, "2031-04")).some((row) => row.id === transaction.id),
    ).toBe(false);
  });

  it("rejects categories from the other side of the ledger", async () => {
    await expect(
      createTransaction(userA, {
        type: "EXPENSE",
        amountMinor: 1000,
        note: "",
        date: `${MONTH}-01`,
        categoryId: salary,
      }),
    ).rejects.toThrow("other side");
  });

  it("clears a kept category when the type flips, but rejects an explicit mismatch", async () => {
    const transaction = await createTransaction(userA, {
      type: "EXPENSE",
      amountMinor: 90_000,
      note: "type flip",
      date: `${MONTH}-02`,
      categoryId: food,
    });

    const flipped = await updateTransaction(userA, { id: transaction.id, type: "INCOME" });
    expect(flipped.type).toBe("INCOME");
    expect(flipped.category).toBeNull();

    await expect(
      updateTransaction(userA, { id: transaction.id, categoryId: food }),
    ).rejects.toThrow("other side");
  });

  it("never exposes another user's data", async () => {
    const transaction = await createTransaction(userA, {
      type: "EXPENSE",
      amountMinor: 10_000,
      note: "private",
      date: `${MONTH}-03`,
      categoryId: null,
    });

    await expect(updateTransaction(userB, { id: transaction.id, note: "hacked" })).rejects.toThrow(
      "not found",
    );
    await expect(deleteTransaction(userB, transaction.id)).rejects.toThrow("not found");
    expect((await listTransactions(userB, MONTH)).some((row) => row.id === transaction.id)).toBe(
      false,
    );
    // Foreign categories can't be attached either.
    await expect(
      createTransaction(userB, {
        type: "EXPENSE",
        amountMinor: 1000,
        note: "",
        date: `${MONTH}-01`,
        categoryId: food,
      }),
    ).rejects.toThrow("Category not found");
  });

  it("upserts budgets, enforces expense-only, and 0 removes", async () => {
    const created = await setBudget(userA, {
      categoryId: food,
      month: MONTH,
      amountMinor: 2_000_000,
    });
    expect(created?.amountMinor).toBe(2_000_000);

    const updated = await setBudget(userA, {
      categoryId: food,
      month: MONTH,
      amountMinor: 3_000_000,
    });
    expect(updated?.amountMinor).toBe(3_000_000);
    expect(updated?.id).toBe(created?.id);

    // Overall budget (null category) stays single through repeated sets.
    await setBudget(userA, { categoryId: null, month: MONTH, amountMinor: 10_000_000 });
    await setBudget(userA, { categoryId: null, month: MONTH, amountMinor: 12_000_000 });
    const budgets = await listBudgets(userA, MONTH);
    expect(budgets.filter((budget) => budget.categoryId === null)).toHaveLength(1);
    expect(budgets.find((budget) => budget.categoryId === null)?.amountMinor).toBe(12_000_000);

    await setBudget(userA, { categoryId: food, month: MONTH, amountMinor: 0 });
    expect((await listBudgets(userA, MONTH)).some((budget) => budget.categoryId === food)).toBe(
      false,
    );

    await expect(
      setBudget(userA, { categoryId: salary, month: MONTH, amountMinor: 1_000 }),
    ).rejects.toThrow("expense categories");
  });

  it("aggregates the month overview from real rows", async () => {
    const month = "2031-07";
    await createTransaction(userA, {
      type: "INCOME",
      amountMinor: 30_000_000,
      note: "lương",
      date: `${month}-05`,
      categoryId: salary,
    });
    await createTransaction(userA, {
      type: "EXPENSE",
      amountMinor: 4_000_000,
      note: "chợ",
      date: `${month}-06`,
      categoryId: food,
    });
    await createTransaction(userA, {
      type: "EXPENSE",
      amountMinor: 500_000,
      note: "linh tinh",
      date: `${month}-07`,
      categoryId: null,
    });

    const overview = await getMonthOverview(userA, month);
    expect(overview.income).toBe(30_000_000);
    expect(overview.expense).toBe(4_500_000);
    expect(overview.byCategory[0]).toMatchObject({ name: "Food", total: 4_000_000 });
    expect(overview.byCategory[1]).toMatchObject({ name: "Uncategorized", total: 500_000 });
    expect(overview.trend).toHaveLength(6);
    expect(overview.trend.at(-1)).toEqual({ month, income: 30_000_000, expense: 4_500_000 });
  });

  it("applies reviewed assignments atomically with type checks", async () => {
    const month = "2031-09";
    const one = await createTransaction(userA, {
      type: "EXPENSE",
      amountMinor: 60_000,
      note: "cafe",
      date: `${month}-01`,
      categoryId: null,
    });
    const two = await createTransaction(userA, {
      type: "INCOME",
      amountMinor: 1_000_000,
      note: "thưởng",
      date: `${month}-02`,
      categoryId: null,
    });

    const uncategorized = await listUncategorized(userA, month);
    expect(uncategorized.map((row) => row.id)).toEqual(expect.arrayContaining([one.id, two.id]));

    const applied = await applyCategoryAssignments(userA, [
      { transactionId: one.id, categoryId: food },
      { transactionId: two.id, categoryId: salary },
    ]);
    expect(applied).toBe(2);

    // Cross-type assignment fails whole batch.
    await expect(
      applyCategoryAssignments(userA, [{ transactionId: one.id, categoryId: salary }]),
    ).rejects.toThrow("no longer matches");

    // Foreign ownership fails too.
    await expect(
      applyCategoryAssignments(userB, [{ transactionId: one.id, categoryId: food }]),
    ).rejects.toThrow("not found");
  });

  it("starter categories are idempotent per user", async () => {
    const first = await createStarterCategories(userB);
    const second = await createStarterCategories(userB);
    expect(second.length).toBe(first.length);
  });
});
