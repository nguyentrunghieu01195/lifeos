import { expect, test, type Page } from "./fixtures";

/** Habits journey: create, check-in, streak counter, archive, AI degradation. */

const password = "a sufficiently long password";

function uniqueEmail(): string {
  return `e2e-habits-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

async function registerAndOpenHabits(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Habits Tester");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Habits", exact: true }).click();
  await expect(page).toHaveURL(/\/habits/, { timeout: 15_000 });
}

async function createHabit(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "New habit" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
}

test.describe("habits", () => {
  test("creates a habit, checks it in and sees the streak counter", async ({ page }) => {
    await registerAndOpenHabits(page);
    await expect(page.getByText("No habits yet — start building your first streak.")).toBeVisible();

    await createHabit(page, "Morning meditation");

    // The circle toggle is aria-label "Check Morning meditation"
    const toggleButton = page.getByRole("button", { name: "Check Morning meditation" });
    await expect(toggleButton).toBeVisible();

    await toggleButton.click();
    // After check-in: button becomes Uncheck and the streak counter appears.
    await expect(page.getByRole("button", { name: "Uncheck Morning meditation" })).toBeVisible({
      timeout: 10_000,
    });
    // Streak counter: flame icon + "1" somewhere near the card.
    await expect(page.getByText("1 of 1 today")).toBeVisible({ timeout: 15_000 });

    // Uncheck it
    await page.getByRole("button", { name: "Uncheck Morning meditation" }).click();
    await expect(page.getByRole("button", { name: "Check Morning meditation" })).toBeVisible({
      timeout: 10_000,
    });

    // Dashboard shows the habits widget.
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByText("Today's habits")).toBeVisible();
    await expect(page.getByText("Morning meditation")).toBeVisible();
  });

  test("edits and archives a habit", async ({ page }) => {
    await registerAndOpenHabits(page);
    await createHabit(page, "Evening walk");

    // Edit: open options menu
    await page.getByRole("button", { name: "Options for Evening walk" }).click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByLabel("Name").fill("Evening run");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Evening run")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Evening walk")).not.toBeVisible();

    // Archive: two-click confirm
    await page.getByRole("button", { name: "Options for Evening run" }).click();
    await page.getByRole("menuitem", { name: "Archive" }).click(); // arms
    await page.getByRole("button", { name: "Options for Evening run" }).click();
    await page.getByRole("menuitem", { name: "Confirm archive" }).click();
    await expect(page.getByText("Evening run")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("No habits yet — start building your first streak.")).toBeVisible();
  });

  test("AI habit suggestions degrade gracefully without a provider", async ({ page }) => {
    await registerAndOpenHabits(page);
    await page.getByRole("button", { name: "New habit" }).click();
    await page.getByRole("button", { name: "Get AI suggestions" }).click();
    await page.getByLabel("Your goal for AI habit suggestions").fill("I want to be healthier");
    await page.getByRole("button", { name: "Suggest habits" }).click();
    await expect(page.getByText(/GEMINI_API_KEY|provider/i)).toBeVisible({ timeout: 15_000 });
  });
});
