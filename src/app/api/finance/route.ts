import { NextResponse, type NextRequest } from "next/server";

import { currentMonthKey, isMonthKey } from "@/features/finance/lib/money";
import {
  getMonthOverview,
  listBudgets,
  listCategories,
  listTransactions,
} from "@/features/finance/server/service";
import { getSessionUserId } from "@/lib/auth";

/** Read endpoint for TanStack Query refetches (initial data comes from RSC). */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = request.nextUrl.searchParams.get("month");
  const month = requested && isMonthKey(requested) ? requested : currentMonthKey();

  const [overview, transactions, categories, budgets] = await Promise.all([
    getMonthOverview(userId, month),
    listTransactions(userId, month),
    listCategories(userId),
    listBudgets(userId, month),
  ]);

  return NextResponse.json({ month, overview, transactions, categories, budgets });
}
