import { expect, test, type Page } from "@playwright/test";

/** Tasks module journey: quick add, complete, edit, views, AI degradation. */

const password = "a sufficiently long password";

function uniqueEmail(): string {
  return `e2e-tasks-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

async function registerAndOpenTasks(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Tasks Tester");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks/);
}

test.describe("tasks", () => {
  test("quick-adds, completes and edits a task", async ({ page }) => {
    await registerAndOpenTasks(page);

    // Quick add lands in Someday (no due date).
    await page.getByLabel("Quick add task").fill("Buy oat milk");
    await page.getByLabel("Quick add task").press("Enter");
    await expect(page.getByText("Buy oat milk")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Someday/ })).toBeVisible();

    // Complete it — moves into the collapsed Done section.
    await page.getByRole("button", { name: 'Complete "Buy oat milk"' }).click();
    await expect(page.getByRole("button", { name: /Done · 1/ })).toBeVisible();

    // Full editor: create a task due today with high priority.
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Title").fill("Review pull request");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Due date").fill(today);
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByRole("heading", { name: /Today/ })).toBeVisible();
    await expect(page.getByText("Review pull request")).toBeVisible();

    // Edit the title through the sheet.
    await page.getByRole("button", { name: 'Edit "Review pull request"' }).first().click();
    await page.getByLabel("Title").fill("Review and merge pull request");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Review and merge pull request")).toBeVisible();
  });

  test("board and calendar views render the same data", async ({ page }) => {
    await registerAndOpenTasks(page);

    await page.getByLabel("Quick add task").fill("Board visible task");
    await page.getByLabel("Quick add task").press("Enter");
    await expect(page.getByText("Board visible task")).toBeVisible();

    await page.getByRole("tab", { name: "Board" }).click();
    await expect(page.getByRole("region", { name: "To do" })).toBeVisible();
    await expect(page.getByRole("region", { name: "In progress" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Done" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "To do" }).getByText("Board visible task"),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Calendar" }).click();
    const monthName = new Date().toLocaleString("en", { month: "long" });
    await expect(page.getByRole("heading", { name: new RegExp(monthName) })).toBeVisible();
  });

  test("AI planning degrades gracefully when no provider is configured", async ({ page }) => {
    await registerAndOpenTasks(page);

    await page.getByRole("button", { name: "Plan with AI" }).click();
    await page
      .getByLabel("Describe what to plan")
      .fill("Plan a weekend hiking trip with two friends");
    await page.getByRole("button", { name: "Generate tasks" }).click();

    // CI has no AI key: the dialog surfaces a clear configuration error.
    await expect(page.getByRole("alert")).toContainText(/GEMINI_API_KEY|provider/i);
  });
});
