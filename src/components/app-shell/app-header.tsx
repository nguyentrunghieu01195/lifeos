"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCommandPalette } from "@/store/command-palette";

import { navItemForPathname } from "./nav-config";

/**
 * Top bar of the authenticated shell: sidebar trigger, current section title,
 * command palette trigger, theme toggle and the user menu (passed in as a
 * server-rendered slot).
 */
export function AppHeader({ userMenu }: { userMenu: ReactNode }) {
  const pathname = usePathname();
  const setPaletteOpen = useCommandPalette((state) => state.setOpen);
  const section = navItemForPathname(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <h1 className="text-sm font-medium">{section?.title ?? "LifeOS"}</h1>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="hidden w-56 justify-between font-normal text-muted-foreground md:flex"
          onClick={() => setPaletteOpen(true)}
        >
          <span className="flex items-center gap-2">
            <Search aria-hidden className="size-3.5" />
            Search or jump to…
          </span>
          <kbd className="pointer-events-none rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open command palette"
          onClick={() => setPaletteOpen(true)}
        >
          <Search aria-hidden />
        </Button>
        <ThemeToggle />
        {userMenu}
      </div>
    </header>
  );
}
