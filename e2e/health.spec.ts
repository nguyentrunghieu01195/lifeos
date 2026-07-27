import { expect, test, type Page } from "./fixtures";

/** Health journey: log weight, sleep, water, workout; AI analysis degradation. */

const password = "a sufficiently long password";

function uniqueEmail(): string {
  return `e2e-health-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

async function registerAndOpenHealth(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Health Tester");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Health", exact: true }).click();
  await expect(page).toHaveURL(/\/health/, { timeout: 15_000 });
}

test.describe("health", () => {
  test("logs weight and sees the stat card", async ({ page }) => {
    await registerAndOpenHealth(page);

    await expect(page.getByRole("tab", { name: /Weight/ })).toBeVisible();
    await page.getByLabel("Weight in kg").fill("70.5");
    await page.getByRole("button", { name: "Log", exact: true }).click();
    // "Latest" stat card with the value
    await expect(page.getByText("Latest")).toBeVisible({ timeout: 15_000 });
    // The logged row shows "Logged: 70.5 kg"
    await expect(page.getByText(/Logged:.*70\.5 kg/)).toBeVisible({ timeout: 5_000 });
  });

  test("logs sleep with quality rating", async ({ page }) => {
    await registerAndOpenHealth(page);

    await page.getByRole("tab", { name: /Sleep/ }).click();
    await page.getByLabel("Sleep duration in hours").fill("7.5");
    await page.getByRole("button", { name: "Quality 4: Great" }).click();
    await page.getByRole("button", { name: "Log", exact: true }).click();
    // Logged row shows the hours and quality
    await expect(page.getByText(/Logged:.*7h 30m/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/quality 4\/5/)).toBeVisible({ timeout: 5_000 });
  });

  test("adds and removes water glasses with optimistic counter", async ({ page }) => {
    await registerAndOpenHealth(page);

    await page.getByRole("tab", { name: /Water/ }).click();
    // Start at 0; tap +1 three times using the last "Add a glass" button (the + icon)
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "Add a glass of water" }).last().click();
    }
    // Optimistic update: the big counter shows 3
    await expect(page.locator("span[aria-live]").filter({ hasText: "3" })).toBeVisible({
      timeout: 10_000,
    });

    // Remove one
    await page.getByRole("button", { name: "Remove a glass of water" }).click();
    await expect(page.getByText(/2 glasses today/)).toBeVisible({ timeout: 10_000 });
  });

  test("logs a workout and shows it in history", async ({ page }) => {
    await registerAndOpenHealth(page);

    await page.getByRole("tab", { name: /Workout/ }).click();
    await page.getByLabel("Workout exercise name").fill("Morning run");
    await page.getByLabel("Workout duration in minutes").fill("30");
    await page.getByRole("button", { name: "Log", exact: true }).click();
    // Both today's list and recent workouts show the name — just confirm it appears
    await expect(page.getByText("Morning run").first()).toBeVisible({ timeout: 15_000 });
    // Duration appears in the today list
    await expect(page.getByText("30 min").first()).toBeVisible({ timeout: 5_000 });
  });

  test("AI analysis degrades gracefully without a provider", async ({ page }) => {
    await registerAndOpenHealth(page);
    // Log some data first so the service has something to read
    await page.getByLabel("Weight in kg").fill("70");
    await page.getByRole("button", { name: "Log", exact: true }).click();
    await expect(page.getByText("Latest")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "AI Analyse" }).click();
    await expect(page.getByText(/GEMINI_API_KEY|provider/i)).toBeVisible({ timeout: 15_000 });
  });

  test("dashboard shows health widget after logging", async ({ page }) => {
    await registerAndOpenHealth(page);
    await page.getByLabel("Weight in kg").fill("65");
    await page.getByRole("button", { name: "Log", exact: true }).click();
    await expect(page.getByText("Latest")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByText("Today's health")).toBeVisible();
    // The dashboard widget shows formatted weight
    await expect(page.getByText("65.0 kg")).toBeVisible({ timeout: 10_000 });
  });
});
