import {
  BookOpen,
  Bookmark,
  CalendarDays,
  CheckCircle2,
  FileText,
  Flame,
  HeartPulse,
  LayoutDashboard,
  Settings,
  ShoppingCart,
  Sparkles,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for app navigation. The sidebar, the command palette
 * and the dashboard modules widget all render from this config — shipping a
 * new module means flipping its status here (plus its routes).
 */

export type ModuleStatus = "available" | "soon";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  status: ModuleStatus;
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        status: "available",
        description: "Your day at a glance",
      },
    ],
  },
  {
    label: "Work",
    items: [
      {
        title: "Tasks",
        href: "/tasks",
        icon: CheckCircle2,
        status: "available",
        description: "Projects, priorities and boards",
      },
      {
        title: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
        status: "available",
        description: "Day, week and month planning",
      },
      {
        title: "Notes",
        href: "/notes",
        icon: StickyNote,
        status: "available",
        description: "Rich notes with markdown",
      },
      {
        title: "Documents",
        href: "/documents",
        icon: FileText,
        status: "available",
        description: "Files, PDFs and uploads",
      },
    ],
  },
  {
    label: "Life",
    items: [
      {
        title: "Finance",
        href: "/finance",
        icon: Wallet,
        status: "available",
        description: "Income, expenses and budgets",
      },
      {
        title: "Habits",
        href: "/habits",
        icon: Flame,
        status: "soon",
        description: "Streaks and daily tracking",
      },
      {
        title: "Health",
        href: "/health",
        icon: HeartPulse,
        status: "soon",
        description: "Weight, sleep, water and workouts",
      },
      {
        title: "Shopping",
        href: "/shopping",
        icon: ShoppingCart,
        status: "soon",
        description: "Smart lists with totals",
      },
    ],
  },
  {
    label: "Knowledge",
    items: [
      {
        title: "Knowledge base",
        href: "/knowledge",
        icon: BookOpen,
        status: "soon",
        description: "Linked notes and backlinks",
      },
      {
        title: "Bookmarks",
        href: "/bookmarks",
        icon: Bookmark,
        status: "soon",
        description: "Save and organize links",
      },
    ],
  },
  {
    label: "AI",
    items: [
      {
        title: "AI Chat",
        href: "/chat",
        icon: Sparkles,
        status: "soon",
        description: "An assistant that knows your data",
      },
    ],
  },
];

export const SETTINGS_NAV: NavItem = {
  title: "Settings",
  href: "/settings",
  icon: Settings,
  status: "soon",
  description: "Profile, preferences and account",
};

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  SETTINGS_NAV,
];

/** Items that are live today (used by the command palette navigation group). */
export const AVAILABLE_NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter(
  (item) => item.status === "available",
);

/** Resolve the current section title from a pathname (header display). */
export function navItemForPathname(pathname: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}
