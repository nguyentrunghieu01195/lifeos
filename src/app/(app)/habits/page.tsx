import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HabitsView } from "@/features/habits/components/habits-view";
import { listHabits } from "@/features/habits/server/service";
import { getSessionUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Habits" };

export default async function HabitsPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const today = new Date().toISOString().slice(0, 10);
  const habits = await listHabits(userId, today);

  return <HabitsView today={today} habits={habits} />;
}
