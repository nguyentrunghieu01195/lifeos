import "server-only";

import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

import {
  addMonths,
  currentMonthKey,
  dateStringToUtc,
  monthRangeUtc,
  toAmountNumber,
  utcToDateString,
} from "../lib/money";
import { buildTrend, groupExpensesByCategory, sumByType, type LedgerRow } from "../lib/summary";
import type {
  CreateCategoryInput,
  CreateTransactionInput,
  SetBudgetInput,
  UpdateTransactionInput,
} from "../schemas";
import type {
  BudgetDto,
  CategoryDto,
  MonthOverviewDto,
  TransactionDto,
  TransactionTypeDto,
} from "../types";

/** Finance domain service — every read/write is scoped to the explicit userId. */

const TREND_MONTHS = 6;

const categorySelect = { id: true, name: true, icon: true, color: true, type: true };
const transactionSelect = {
  id: true,
  type: true,
  amountMinor: true,
  note: true,
  occurredAt: true,
  category: { select: { id: true, name: true, icon: true, color: true } },
};

type TransactionRecord = {
  id: string;
  type: TransactionTypeDto;
  amountMinor: bigint;
  note: string;
  occurredAt: Date;
  category: { id: string; name: string; icon: string; color: string } | null;
};

function toTransactionDto(record: TransactionRecord): TransactionDto {
  return {
    id: record.id,
    type: record.type,
    amountMinor: toAmountNumber(record.amountMinor),
    note: record.note,
    date: utcToDateString(record.occurredAt),
    category: record.category,
  };
}

// --- Categories --------------------------------------------------------------

export async function listCategories(userId: string): Promise<CategoryDto[]> {
  return getDb().financeCategory.findMany({
    where: { userId },
    select: categorySelect,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(
  userId: string,
  input: CreateCategoryInput,
): Promise<CategoryDto> {
  try {
    return await getDb().financeCategory.create({
      data: { userId, name: input.name, type: input.type, icon: input.icon, color: input.color },
      select: categorySelect,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("A category with this name already exists.", {
        code: "VALIDATION",
        status: 409,
      });
    }
    throw error;
  }
}

const STARTER_CATEGORIES: Array<Pick<CategoryDto, "name" | "icon" | "color" | "type">> = [
  { name: "Food & Drink", icon: "🍜", color: "#f97316", type: "EXPENSE" },
  { name: "Transport", icon: "🛵", color: "#0ea5e9", type: "EXPENSE" },
  { name: "Housing", icon: "🏠", color: "#8b5cf6", type: "EXPENSE" },
  { name: "Utilities", icon: "💡", color: "#eab308", type: "EXPENSE" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899", type: "EXPENSE" },
  { name: "Entertainment", icon: "🎬", color: "#22c55e", type: "EXPENSE" },
  { name: "Health", icon: "💊", color: "#ef4444", type: "EXPENSE" },
  { name: "Salary", icon: "💼", color: "#10b981", type: "INCOME" },
  { name: "Bonus", icon: "🎁", color: "#6366f1", type: "INCOME" },
];

/** One-click starter set — explicit user action, skips names that exist. */
export async function createStarterCategories(userId: string): Promise<CategoryDto[]> {
  await getDb().financeCategory.createMany({
    data: STARTER_CATEGORIES.map((category) => ({ ...category, userId })),
    skipDuplicates: true,
  });
  return listCategories(userId);
}

async function assertOwnedCategory(
  userId: string,
  categoryId: string,
): Promise<{ id: string; type: TransactionTypeDto }> {
  const category = await getDb().financeCategory.findFirst({
    where: { id: categoryId, userId },
    select: { id: true, type: true },
  });
  if (!category) {
    throw new AppError("Category not found.", { code: "NOT_FOUND", status: 404 });
  }
  return category;
}

// --- Transactions ------------------------------------------------------------

export async function listTransactions(userId: string, month: string): Promise<TransactionDto[]> {
  const { start, end } = monthRangeUtc(month);
  const rows = await getDb().transaction.findMany({
    where: { userId, occurredAt: { gte: start, lt: end } },
    select: transactionSelect,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
  });
  return (rows as TransactionRecord[]).map(toTransactionDto);
}

export async function createTransaction(
  userId: string,
  input: CreateTransactionInput,
): Promise<TransactionDto> {
  if (input.categoryId) {
    const category = await assertOwnedCategory(userId, input.categoryId);
    if (category.type !== input.type) {
      throw new AppError("That category belongs to the other side of the ledger.", {
        code: "VALIDATION",
        status: 400,
      });
    }
  }

  const row = await getDb().transaction.create({
    data: {
      userId,
      type: input.type,
      amountMinor: BigInt(input.amountMinor),
      note: input.note,
      occurredAt: dateStringToUtc(input.date),
      categoryId: input.categoryId ?? null,
    },
    select: transactionSelect,
  });
  return toTransactionDto(row as TransactionRecord);
}

export async function updateTransaction(
  userId: string,
  input: UpdateTransactionInput,
): Promise<TransactionDto> {
  const existing = await getDb().transaction.findFirst({
    where: { id: input.id, userId },
    select: { id: true, type: true, categoryId: true },
  });
  if (!existing) {
    throw new AppError("Transaction not found.", { code: "NOT_FOUND", status: 404 });
  }

  const nextType = input.type ?? existing.type;
  // Resolve the category against the FINAL type: an explicit categoryId must
  // match it; a kept category that no longer matches is cleared, not kept lying.
  let nextCategoryId = input.categoryId !== undefined ? input.categoryId : existing.categoryId;
  if (nextCategoryId) {
    const category = await assertOwnedCategory(userId, nextCategoryId);
    if (category.type !== nextType) {
      if (input.categoryId !== undefined) {
        throw new AppError("That category belongs to the other side of the ledger.", {
          code: "VALIDATION",
          status: 400,
        });
      }
      nextCategoryId = null;
    }
  }

  const data: Record<string, unknown> = { type: nextType, categoryId: nextCategoryId };
  if (input.amountMinor !== undefined) data.amountMinor = BigInt(input.amountMinor);
  if (input.note !== undefined) data.note = input.note;
  if (input.date !== undefined) data.occurredAt = dateStringToUtc(input.date);

  const row = await getDb().transaction.update({
    where: { id: existing.id },
    data,
    select: transactionSelect,
  });
  return toTransactionDto(row as TransactionRecord);
}

export async function deleteTransaction(userId: string, id: string): Promise<void> {
  const result = await getDb().transaction.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new AppError("Transaction not found.", { code: "NOT_FOUND", status: 404 });
  }
}

/** Bulk-apply reviewed AI assignments. All-or-nothing, every row re-checked. */
export async function applyCategoryAssignments(
  userId: string,
  assignments: Array<{ transactionId: string; categoryId: string }>,
): Promise<number> {
  const db = getDb();
  const [transactions, categories] = await Promise.all([
    db.transaction.findMany({
      where: { id: { in: assignments.map((entry) => entry.transactionId) }, userId },
      select: { id: true, type: true },
    }),
    db.financeCategory.findMany({
      where: { id: { in: [...new Set(assignments.map((entry) => entry.categoryId))] }, userId },
      select: { id: true, type: true },
    }),
  ]);
  const transactionById = new Map(transactions.map((row) => [row.id, row]));
  const categoryById = new Map(categories.map((row) => [row.id, row]));

  const updates = assignments.map((entry) => {
    const transaction = transactionById.get(entry.transactionId);
    const category = categoryById.get(entry.categoryId);
    if (!transaction || !category) {
      throw new AppError("Transaction or category not found.", {
        code: "NOT_FOUND",
        status: 404,
      });
    }
    if (transaction.type !== category.type) {
      throw new AppError("A suggested category no longer matches its transaction type.", {
        code: "VALIDATION",
        status: 400,
      });
    }
    return db.transaction.update({
      where: { id: transaction.id },
      data: { categoryId: category.id },
    });
  });

  await db.$transaction(updates);
  return updates.length;
}

// --- Budgets -----------------------------------------------------------------

export async function listBudgets(userId: string, month: string): Promise<BudgetDto[]> {
  const rows = await getDb().budget.findMany({
    where: { userId, month },
    select: { id: true, categoryId: true, month: true, amountMinor: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({ ...row, amountMinor: toAmountNumber(row.amountMinor) }));
}

/**
 * Upsert semantics; amount 0 removes the budget. The overall budget
 * (categoryId null) can't use a DB unique (Postgres treats NULLs as
 * distinct), so it is looked up explicitly.
 */
export async function setBudget(userId: string, input: SetBudgetInput): Promise<BudgetDto | null> {
  if (input.categoryId) {
    const category = await assertOwnedCategory(userId, input.categoryId);
    if (category.type !== "EXPENSE") {
      throw new AppError("Budgets apply to expense categories.", {
        code: "VALIDATION",
        status: 400,
      });
    }
  }

  const db = getDb();
  const existing = await db.budget.findFirst({
    where: { userId, month: input.month, categoryId: input.categoryId },
    select: { id: true },
  });

  if (input.amountMinor === 0) {
    if (existing) await db.budget.delete({ where: { id: existing.id } });
    return null;
  }

  const data = { amountMinor: BigInt(input.amountMinor) };
  const row = existing
    ? await db.budget.update({
        where: { id: existing.id },
        data,
        select: { id: true, categoryId: true, month: true, amountMinor: true },
      })
    : await db.budget.create({
        data: { userId, month: input.month, categoryId: input.categoryId, ...data },
        select: { id: true, categoryId: true, month: true, amountMinor: true },
      });
  return { ...row, amountMinor: toAmountNumber(row.amountMinor) };
}

// --- Aggregates ---------------------------------------------------------------

async function ledgerRows(userId: string, firstMonth: string, lastMonth: string) {
  const { start } = monthRangeUtc(firstMonth);
  const { end } = monthRangeUtc(lastMonth);
  const rows = await getDb().transaction.findMany({
    where: { userId, occurredAt: { gte: start, lt: end } },
    select: { type: true, amountMinor: true, occurredAt: true, categoryId: true },
  });
  return rows.map((row): LedgerRow => ({
    type: row.type,
    amountMinor: toAmountNumber(row.amountMinor),
    month: row.occurredAt.toISOString().slice(0, 7),
    categoryId: row.categoryId,
  }));
}

export async function getMonthOverview(userId: string, month: string): Promise<MonthOverviewDto> {
  const firstTrendMonth = addMonths(month, -(TREND_MONTHS - 1));
  const [rows, categories] = await Promise.all([
    ledgerRows(userId, firstTrendMonth, month),
    listCategories(userId),
  ]);

  const monthRows = rows.filter((row) => row.month === month);
  const { income, expense } = sumByType(monthRows);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const byCategory = groupExpensesByCategory(monthRows).map((entry) => {
    const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
    return {
      categoryId: entry.categoryId,
      name: category?.name ?? "Uncategorized",
      icon: category?.icon ?? "❔",
      color: category?.color ?? "#94a3b8",
      total: entry.total,
    };
  });

  return {
    month,
    income,
    expense,
    byCategory,
    trend: buildTrend(rows, firstTrendMonth, month),
  };
}

/** Dashboard widget numbers for the current month. */
export async function getDashboardFinance(userId: string): Promise<{
  month: string;
  income: number;
  expense: number;
  topCategory: { name: string; icon: string; total: number } | null;
}> {
  const month = currentMonthKey();
  const overview = await getMonthOverview(userId, month);
  const top = overview.byCategory[0] ?? null;
  return {
    month,
    income: overview.income,
    expense: overview.expense,
    topCategory: top ? { name: top.name, icon: top.icon, total: top.total } : null,
  };
}

/** Uncategorized rows for the AI bulk flow (most recent first). */
export async function listUncategorized(
  userId: string,
  month: string,
  limit = 20,
): Promise<TransactionDto[]> {
  const { start, end } = monthRangeUtc(month);
  const rows = await getDb().transaction.findMany({
    where: { userId, categoryId: null, occurredAt: { gte: start, lt: end } },
    select: transactionSelect,
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
  return (rows as TransactionRecord[]).map(toTransactionDto);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
