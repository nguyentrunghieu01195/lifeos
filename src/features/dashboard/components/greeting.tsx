"use client";

import { useEffect, useState } from "react";

import { formatFullDate, greetingForHour } from "@/utils/greeting";

/**
 * Time-of-day greeting computed on the client so it follows the viewer's
 * clock and locale (the server runs in UTC). Renders a timezone-neutral
 * greeting until mounted to avoid hydration mismatches.
 */
export function Greeting({ firstName }: { firstName: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  return (
    <header>
      <h2 className="text-3xl font-semibold tracking-tight">
        {now ? greetingForHour(now.getHours()) : "Welcome back"}, {firstName}
      </h2>
      <p className="mt-1 text-muted-foreground" suppressHydrationWarning>
        {now ? formatFullDate(now) : "Your personal operating system is ready."}
      </p>
    </header>
  );
}
