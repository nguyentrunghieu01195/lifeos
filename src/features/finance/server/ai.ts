import "server-only";

import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { completeWithRetry } from "@/services/ai";

import { parseCategorySuggestions } from "../lib/ai-parse";
import { toAmountNumber, utcToDateString } from "../lib/money";
import type { CategorySuggestionDto } from "../types";

const SYSTEM_PROMPT = `You are the LifeOS bookkeeping assistant. Assign the best-fitting category to each transaction.

Respond with ONLY valid JSON in exactly this shape:
{"assignments":[{"transactionId":"...","categoryId":"..."}]}

Rules:
- Pick categoryId ONLY from the provided category list, and only where the category type matches the transaction type.
- Notes may be in any language (often Vietnamese) — infer meaning, e.g. "ăn trưa" is food, "xăng xe" is transport, "tiền nhà" is housing.
- When no category fits confidently, set "categoryId" to null.
- Include every transaction exactly once. No markdown, no commentary — JSON only.`;

/**
 * Suggest categories for the given transactions. Read-only: the caller shows
 * the suggestions for review and applies them through a separate action.
 */
export async function suggestCategories(
  userId: string,
  transactionIds: string[],
): Promise<CategorySuggestionDto[]> {
  const db = getDb();
  const [transactions, categories] = await Promise.all([
    db.transaction.findMany({
      where: { id: { in: transactionIds }, userId },
      select: { id: true, type: true, note: true, amountMinor: true, occurredAt: true },
    }),
    db.financeCategory.findMany({
      where: { userId },
      select: { id: true, name: true, type: true },
    }),
  ]);

  if (transactions.length === 0) {
    throw new AppError("No matching transactions found.", { code: "NOT_FOUND", status: 404 });
  }
  if (categories.length === 0) {
    throw new AppError("Create some categories first — the AI can only pick from your list.", {
      code: "VALIDATION",
      status: 400,
    });
  }

  const payload = {
    transactions: transactions.map((row) => ({
      transactionId: row.id,
      type: row.type,
      note: row.note || "(no note)",
      amount: toAmountNumber(row.amountMinor),
      date: utcToDateString(row.occurredAt),
    })),
    categories: categories.map((category) => ({
      categoryId: category.id,
      name: category.name,
      type: category.type,
    })),
  };

  const completion = await completeWithRetry({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload) },
    ],
    jsonMode: true,
    temperature: 0.2,
    maxOutputTokens: 1200,
  });

  const parsed = parseCategorySuggestions(completion.text, transactions, categories);
  if (!parsed.ok) {
    throw new AppError(`${parsed.error} Try again.`, { code: "AI_PROVIDER", status: 502 });
  }

  const transactionById = new Map(transactions.map((row) => [row.id, row]));
  return parsed.suggestions.map((suggestion) => {
    const transaction = transactionById.get(suggestion.transactionId)!;
    return {
      transactionId: suggestion.transactionId,
      note: transaction.note,
      amountMinor: toAmountNumber(transaction.amountMinor),
      type: transaction.type,
      categoryId: suggestion.categoryId,
    };
  });
}
