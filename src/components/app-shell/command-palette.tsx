"use client";

import { Home, LogOut, Monitor, Moon, Plus, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { signOutAction } from "@/features/auth/server/actions";
import { useCommandPalette } from "@/store/command-palette";

import { AVAILABLE_NAV_ITEMS } from "./nav-config";

/**
 * Global ⌘K command palette. Modules register their commands here as they
 * ship (navigation entries come straight from nav-config).
 */
export function CommandPalette() {
  const open = useCommandPalette((state) => state.open);
  const setOpen = useCommandPalette((state) => state.setOpen);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        useCommandPalette.getState().toggle();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search for a page or an action"
    >
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {AVAILABLE_NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} onSelect={() => run(() => router.push(item.href))}>
              <item.icon aria-hidden />
              {item.title}
            </CommandItem>
          ))}
          <CommandItem onSelect={() => run(() => router.push("/"))}>
            <Home aria-hidden />
            Landing page
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => router.push("/tasks?new=1"))}>
            <Plus aria-hidden />
            New task
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <Sun aria-hidden />
            Light theme
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <Moon aria-hidden />
            Dark theme
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}>
            <Monitor aria-hidden />
            System theme
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() =>
              run(() => {
                void signOutAction();
              })
            }
          >
            <LogOut aria-hidden />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
