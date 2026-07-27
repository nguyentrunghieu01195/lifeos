"use client";

import { Globe, LogOut, Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutAction } from "@/features/auth/server/actions";
import { useCommandPalette } from "@/store/command-palette";

/** Real, working actions — no dead buttons. Grows as modules ship. */
export function QuickActionsCard() {
  const setPaletteOpen = useCommandPalette((state) => state.setOpen);
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Everything is one shortcut away.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <Button variant="outline" className="justify-between" onClick={() => setPaletteOpen(true)}>
          <span className="flex items-center gap-2">
            <Search aria-hidden className="size-4" />
            Open command palette
          </span>
          <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-2"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun aria-hidden className="size-4 dark:hidden" />
          <Moon aria-hidden className="hidden size-4 dark:block" />
          Switch theme
        </Button>
        <Button variant="outline" className="justify-start gap-2" asChild>
          <Link href="/">
            <Globe aria-hidden className="size-4" />
            View landing page
          </Link>
        </Button>
        <Button
          variant="outline"
          className="justify-start gap-2 text-destructive hover:text-destructive"
          onClick={() => {
            void signOutAction();
          }}
        >
          <LogOut aria-hidden className="size-4" />
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}
