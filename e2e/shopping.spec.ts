import { expect, test, type Page } from "./fixtures";

/** Shopping journey: create list, add items, check off, reset, AI degradation. */

const password = "a sufficiently long password";

function uniqueEmail(): string {
  return `e2e-shop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

async function registerAndOpenShopping(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Shop Tester");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Shopping", exact: true }).click();
  await expect(page).toHaveURL(/\/shopping$/);
}

async function createListAndOpen(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "New list" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/shopping\/[a-z0-9]+/, { timeout: 15_000 });
  // Wait for RSC render to complete — heading appears after full navigation.
  await expect(page.getByRole("heading", { name })).toBeVisible({ timeout: 15_000 });
}

test.describe("shopping", () => {
  test("creates a list, adds items and checks them off", async ({ page }) => {
    await registerAndOpenShopping(page);
    await expect(page.getByText("No shopping lists yet — create your first one.")).toBeVisible();

    await createListAndOpen(page, "Weekly groceries");
    await expect(page.getByRole("heading", { name: "Weekly groceries" })).toBeVisible();

    // Quick add first item
    await page.getByLabel("New item name").fill("Apples");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Apples")).toBeVisible({ timeout: 10_000 });

    // Add second item
    await page.getByLabel("New item name").fill("Milk");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Milk")).toBeVisible({ timeout: 10_000 });

    // Progress shows 0 of 2
    await expect(page.getByText(/0.*of.*2.*items/)).toBeVisible({ timeout: 5_000 });

    // Check off "Apples" — optimistic update
    await page.getByLabel("Toggle Apples").click();
    await expect(page.getByText(/1.*of.*2.*items/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Checked (1)")).toBeVisible({ timeout: 15_000 });

    // Back to list — shows progress bar
    await page.getByRole("link", { name: "Lists" }).click();
    await expect(page).toHaveURL(/\/shopping$/);
    await expect(page.getByText("1 left")).toBeVisible({ timeout: 10_000 });
  });

  test("resets all checked items", async ({ page }) => {
    await registerAndOpenShopping(page);
    await createListAndOpen(page, "Reset test");

    // Add and check one item
    await page.getByLabel("New item name").fill("Eggs");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Eggs")).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("Toggle Eggs").click();
    await expect(page.getByText("Checked (1)")).toBeVisible({ timeout: 10_000 });

    // Reset via options menu
    await page.getByRole("button", { name: "List options" }).click();
    await page.getByRole("menuitem", { name: "Reset (uncheck all)" }).click();
    await expect(page.getByText("Checked (1)")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Eggs")).toBeVisible();
  });

  test("removes an item", async ({ page }) => {
    await registerAndOpenShopping(page);
    await createListAndOpen(page, "Remove test");

    await page.getByLabel("New item name").fill("Bread");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Bread")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Remove Bread" }).click();
    await expect(page.getByText("Bread")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Type something above to add your first item.")).toBeVisible();
  });

  test("AI suggestions degrade gracefully without a provider", async ({ page }) => {
    await registerAndOpenShopping(page);
    await createListAndOpen(page, "AI test list");

    await page.getByRole("button", { name: "AI suggest" }).click();
    await page.getByLabel("AI shopping prompt").fill("nấu bún bò Huế cho 6 người");
    await page.getByRole("button", { name: "Suggest" }).click();
    await expect(page.getByText(/GEMINI_API_KEY|provider/i)).toBeVisible({ timeout: 15_000 });
  });

  test("dashboard shows shopping lists widget", async ({ page }) => {
    await registerAndOpenShopping(page);
    await createListAndOpen(page, "Dashboard list");

    await page.getByLabel("New item name").fill("Coffee");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Coffee")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByText("Shopping lists")).toBeVisible();
    await expect(page.getByText("Dashboard list")).toBeVisible();
  });
});
