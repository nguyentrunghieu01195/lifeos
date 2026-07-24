import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <p className="font-mono text-sm font-medium text-primary">404</p>
        <h1 className="text-3xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="max-w-md text-pretty text-muted-foreground">
          The page you&apos;re looking for was moved, renamed, or never existed.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to LifeOS</Link>
      </Button>
    </main>
  );
}
