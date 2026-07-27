import { describe, expect, it } from "vitest";

import {
  ALL_NAV_ITEMS,
  AVAILABLE_NAV_ITEMS,
  NAV_GROUPS,
  navItemForPathname,
} from "@/components/app-shell/nav-config";

describe("nav-config", () => {
  it("has unique hrefs across all items", () => {
    const hrefs = ALL_NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("covers the full LifeOS module map plus settings", () => {
    // 12 modules in groups + settings in the footer.
    expect(NAV_GROUPS.flatMap((group) => group.items)).toHaveLength(12);
    expect(ALL_NAV_ITEMS).toHaveLength(13);
  });

  it("only the dashboard is live in Phase 3", () => {
    expect(AVAILABLE_NAV_ITEMS.map((item) => item.href)).toEqual(["/dashboard"]);
  });

  it("resolves section titles from pathnames, including nested routes", () => {
    expect(navItemForPathname("/dashboard")?.title).toBe("Dashboard");
    expect(navItemForPathname("/dashboard/anything")?.title).toBe("Dashboard");
    expect(navItemForPathname("/nowhere")).toBeUndefined();
  });
});
