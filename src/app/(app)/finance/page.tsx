import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FinanceView } from "@/features/finance/components/finance-view";
import { currentMonthKey, isMonthKey } from "@/features/finance/lib/money";
import {
  getMonthOverview,
  listBudgets,
  listCategories,
  listTransactions,
} from "@/features/finance/server/service";
import { getSessionUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Finance" };

interface FinancePageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const params = await searchParams;
  const month = params.month && isMonthKey(params.month) ? params.month : currentMonthKey();

  const [overview, transactions, categories, budgets] = await Promise.all([
    getMonthOverview(userId, month),
    listTransactions(userId, month),
    listCategories(userId),
    listBudgets(userId, month),
  ]);

  return (
    <FinanceView
      month={month}
      overview={overview}
      transactions={transactions}
      categories={categories}
      budgets={budgets}
    />
  );
}
