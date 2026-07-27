import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared e2e fixture. Each test gets a unique X-Forwarded-For so the
 * per-IP auth rate limiter (which the app reads from that header) sees every
 * test as a distinct client — exactly what it would be in production. Without
 * this, the whole suite shares CI's single IP and eventually trips the
 * registration limit. This changes test transport only, never app behavior.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const unique = `${testInfo.workerIndex + 1}.${(testInfo.parallelIndex + 1) % 255}.${
      Math.floor(Math.random() * 255)
    }.${Math.floor(Math.random() * 254) + 1}`;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${unique}` });
    await use(page);
  },
});

export { expect, type Page };
