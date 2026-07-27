import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountCard } from "@/features/dashboard/components/account-card";
import { FinanceSummaryCard } from "@/features/dashboard/components/finance-summary";
import { TodayHabitsCard } from "@/features/dashboard/components/today-habits";
import { HealthSummaryCard } from "@/features/dashboard/components/health-summary";
import { Greeting } from "@/features/dashboard/components/greeting";
import { ModulesOverviewCard } from "@/features/dashboard/components/modules-overview";
import { QuickActionsCard } from "@/features/dashboard/components/quick-actions";
import { RecentNotesCard } from "@/features/dashboard/components/recent-notes";
import { TodayTasksCard } from "@/features/dashboard/components/today-tasks";
import { UpcomingEventsCard } from "@/features/dashboard/components/upcoming-events";
import { getUpcomingEvents } from "@/features/calendar/server/service";
import { getDashboardFinance } from "@/features/finance/server/service";
import { getTodayHabits } from "@/features/habits/server/service";
import { getTodayHealth } from "@/features/health/server/service";
import { getRecentNotes } from "@/features/notes/server/service";
import { getTodayTaskSummary } from "@/features/tasks/server/service";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The dashboard is a grid of widgets over real data. Module widgets (today's
 * tasks, upcoming events, monthly spending, …) ship together with their
 * modules — nothing here ever renders fabricated numbers.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user, taskSummary, upcomingEvents, recentNotes, finance, todayHabits, todayHealth] =
    await Promise.all([
      getDb().user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, image: true, createdAt: true },
      }),
      getTodayTaskSummary(session.user.id),
      getUpcomingEvents(session.user.id),
      getRecentNotes(session.user.id),
      getDashboardFinance(session.user.id),
      getTodayHabits(session.user.id),
      getTodayHealth(session.user.id),
    ]);
  if (!user) {
    redirect("/login");
  }

  const firstName = user.name?.trim().split(/\s+/)[0] ?? "there";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Greeting firstName={firstName} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TodayTasksCard summary={taskSummary} />
        <UpcomingEventsCard events={upcomingEvents} />
        <RecentNotesCard notes={recentNotes} />
        <FinanceSummaryCard
          income={finance.income}
          expense={finance.expense}
          topCategory={finance.topCategory}
        />
        <TodayHabitsCard
          total={todayHabits.total}
          done={todayHabits.done}
          habits={todayHabits.habits}
        />
        <HealthSummaryCard data={todayHealth} />
        <AccountCard
          name={user.name}
          email={user.email}
          image={user.image}
          createdAt={user.createdAt}
        />
        <QuickActionsCard />
        <ModulesOverviewCard />
      </div>
    </div>
  );
}
