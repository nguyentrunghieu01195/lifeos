import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/app-shell/app-header";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { CommandPalette } from "@/components/app-shell/command-palette";
import { UserMenu } from "@/components/app-shell/user-menu";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Authenticated application shell: inset sidebar (state persisted in a
 * cookie), top bar with command palette and user menu, and the global ⌘K
 * palette. Middleware guards these routes; the session check here is defense
 * in depth and feeds the user menu.
 */
export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getDb().user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true },
  });
  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader userMenu={<UserMenu name={user.name} email={user.email} image={user.image} />} />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
