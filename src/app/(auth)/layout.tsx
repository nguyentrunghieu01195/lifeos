import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-clip px-6 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[30rem] w-[44rem] -translate-x-1/2 rounded-full bg-glow-primary blur-2xl" />
      </div>
      <Link href="/" className="mb-8" aria-label="LifeOS home">
        <Logo />
      </Link>
      <main className="w-full max-w-md rounded-2xl glass-strong p-8">{children}</main>
    </div>
  );
}
