import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountCard } from "@/features/dashboard/components/account-card";
import { Greeting } from "@/features/dashboard/components/greeting";
import { ModulesOverviewCard } from "@/features/dashboard/components/modules-overview";
import { QuickActionsCard } from "@/features/dashboard/components/quick-actions";
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

  const user = await getDb().user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, createdAt: true },
  });
  if (!user) {
    redirect("/login");
  }

  const firstName = user.name?.trim().split(/\s+/)[0] ?? "there";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Greeting firstName={firstName} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
