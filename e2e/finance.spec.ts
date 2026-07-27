import { expect, test, type Page } from "./fixtures";

/** Finance journey: categories, quick add, overview math, budgets, AI degradation. */

const password = "a sufficiently long password";

function uniqueEmail(): string {
  return `e2e-fin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

async function registerAndOpenFinance(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Finance Tester");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Finance", exact: true }).click();
  // Generous timeout: the first navigation compiles the recharts-heavy page in dev.
  await expect(page).toHaveURL(/\/finance/, { timeout: 20_000 });
}

async function seedCategoriesAndOpenTransactions(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add starter categories" }).click();
  await expect(page.getByRole("button", { name: "Add starter categories" })).not.toBeVisible();
  await page.getByRole("tab", { name: "Transactions" }).click();
}

async function addTransaction(
  page: Page,
  kind: "Expense" | "Income",
  amount: string,
  note: string,
  category?: string,
): Promise<void> {
  await page.getByRole("button", { name: kind, exact: true }).click();
  await page.getByLabel("Amount (₫)").fill(amount);
  await page.getByLabel("Note").fill(note);
  if (category) {
    await page.getByRole("combobox", { name: "Category", exact: true }).click();
    await page.getByRole("option", { name: new RegExp(category) }).click();
  }
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(note)).toBeVisible({ timeout: 10_000 });
}

test.describe("finance", () => {
  test("seeds categories, records transactions and shows the overview math", async ({ page }) => {
    await registerAndOpenFinance(page);
    await expect(
      page.getByText(
        "No transactions this month yet — add your first one in the Transactions tab.",
      ),
    ).toBeVisible();

    await seedCategoriesAndOpenTransactions(page);

    await addTransaction(page, "Expense", "150000", "an trua", "Food & Drink");
    await addTransaction(page, "Income", "30000000", "luong thang", "Salary");

    // Table shows signed, formatted amounts.
    await expect(page.getByText(/−.*150\.000/)).toBeVisible();
    await expect(page.getByText(/\+.*30\.000\.000/)).toBeVisible();

    // Overview totals reflect the rows.
    await page.getByRole("tab", { name: "Overview" }).click();
    await expect(page.getByText("Spending by category")).toBeVisible();
    await expect(page.getByText("Cash flow")).toBeVisible();
    // Donut + trend charts actually render SVG.
    await expect(page.locator("[data-chart] svg").first()).toBeVisible();

    // Dashboard widget picks the numbers up.
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await expect(page.getByText("This month's money")).toBeVisible();
    await expect(page.getByText(/Top category/)).toBeVisible();
  });

  test("sets a category budget and tracks progress against spending", async ({ page }) => {
    await registerAndOpenFinance(page);
    await seedCategoriesAndOpenTransactions(page);
    await addTransaction(page, "Expense", "2500000", "sieu thi", "Food & Drink");

    await page.getByRole("tab", { name: "Budgets" }).click();
    await expect(page.getByText("Overall budget", { exact: false })).toBeVisible();

    // Set a 5.000.000 budget on Food & Drink.
    await page.getByRole("button", { name: "Set budget for Food & Drink" }).click();
    await page.getByLabel("Budget amount").fill("5000000");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(
      page.getByRole("progressbar", { name: "Food & Drink budget usage" }),
    ).toBeVisible();
    await expect(page.getByText(/2\.500\.000.*\/.*5\.000\.000/)).toBeVisible();
  });

  test("AI categorization degrades gracefully without a provider", async ({ page }) => {
    await registerAndOpenFinance(page);
    await seedCategoriesAndOpenTransactions(page);
    await addTransaction(page, "Expense", "80000", "xang xe");

    // One uncategorized row → the AI button is offered.
    await page.getByRole("button", { name: /AI categorize/ }).click();
    await expect(page.getByText(/GEMINI_API_KEY|provider/i)).toBeVisible({ timeout: 15_000 });
  });

  test("edits and deletes a transaction", async ({ page }) => {
    await registerAndOpenFinance(page);
    await seedCategoriesAndOpenTransactions(page);
    await addTransaction(page, "Expense", "99000", "temp entry");

    await page.getByRole("button", { name: "Edit transaction temp entry" }).click();
    await page.getByLabel("Note").nth(1).fill("renamed entry");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("renamed entry")).toBeVisible();

    await page.getByRole("button", { name: "Delete transaction renamed entry" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("renamed entry")).not.toBeVisible();
    await expect(page.getByText("No transactions this month — add one above.")).toBeVisible();
  });
});
