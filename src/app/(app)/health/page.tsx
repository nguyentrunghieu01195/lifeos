import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HealthView } from "@/features/health/components/health-view";
import { getHealthSnapshot } from "@/features/health/server/service";
import { getSessionUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Health" };

export default async function HealthPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const snapshot = await getHealthSnapshot(userId);

  return <HealthView initial={snapshot} />;
}
