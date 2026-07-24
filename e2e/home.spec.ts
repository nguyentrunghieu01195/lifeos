import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("renders the hero and all ten module cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "One home for your whole life",
    );
    await expect(
      page.getByRole("heading", { name: "Everything in its place. Every place connected." }),
    ).toBeVisible();
    await expect(page.locator("#modules article")).toHaveCount(10);
  });

  test("has the correct document title and no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto("/");
    await expect(page).toHaveTitle(/LifeOS/);
    expect(consoleErrors).toEqual([]);
  });
});
