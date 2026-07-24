import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

/**
 * Minimal authenticated shell — header with brand and sign-out.
 * Phase 3 replaces this with the full app shell (sidebar, command palette,
 * theme toggle, notifications).
 */
export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/dashboard" aria-label="Dashboard">
            <Logo />
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
