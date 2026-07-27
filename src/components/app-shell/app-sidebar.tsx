"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

import { NAV_GROUPS, SETTINGS_NAV, type NavItem } from "./nav-config";

/**
 * Primary navigation. Renders the full module map from nav-config: live
 * modules link through; unshipped ones are visibly disabled with a "Soon"
 * badge and flip on as their phase lands.
 */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="LifeOS">
              <Link href="/dashboard" aria-label="LifeOS dashboard">
                <Logo withWordmark={false} className="shrink-0" />
                <span className="text-base font-semibold tracking-tight">LifeOS</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavEntry key={item.href} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <NavEntry item={SETTINGS_NAV} pathname={pathname} />
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

  if (item.status === "available") {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
          <Link href={item.href}>
            <item.icon aria-hidden />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton disabled aria-disabled="true" tooltip={`${item.title} — coming soon`}>
        <item.icon aria-hidden />
        <span>{item.title}</span>
        <Badge
          variant="outline"
          className="ml-auto text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden"
        >
          Soon
        </Badge>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
