import { expect, test, type Page } from "@playwright/test";

/** Calendar module journey: create event, switch views, AI degradation. */

const password = "a sufficiently long password";

function uniqueEmail(): string {
  return `e2e-cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

async function registerAndOpenCalendar(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Calendar Tester");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar/);
}

test.describe("calendar", () => {
  test("creates an event and sees it across month, week and agenda views", async ({ page }) => {
    await registerAndOpenCalendar(page);

    await page.getByRole("button", { name: "New event" }).click();
    await page.getByLabel("Title").fill("Design review");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Start date").fill(today);
    await page.getByLabel("Start time").fill("14:00");
    await page.getByLabel("End date").fill(today);
    await page.getByLabel("End time").fill("15:00");
    await page.getByRole("button", { name: "Create event" }).click();

    // Month view (default) shows the chip.
    await expect(page.getByText("Design review")).toBeVisible();

    // Week view renders the timed block.
    await page.getByRole("tab", { name: "Week" }).click();
    await expect(page.getByText("Design review")).toBeVisible();

    // Agenda groups it under today.
    await page.getByRole("tab", { name: "Agenda" }).click();
    await expect(page.getByText("Design review")).toBeVisible();
    await expect(page.getByText(/Today/)).toBeVisible();
  });

  test("edits an event through the sheet", async ({ page }) => {
    await registerAndOpenCalendar(page);

    await page.getByRole("button", { name: "New event" }).click();
    await page.getByLabel("Title").fill("Quick sync");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText("Quick sync")).toBeVisible();

    await page
      .getByRole("button", { name: /Quick sync/ })
      .first()
      .click();
    await page.getByLabel("Title").fill("Quick sync — moved");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Quick sync — moved")).toBeVisible();
  });

  test("tasks with due dates appear as dashed chips", async ({ page }) => {
    await registerAndOpenCalendar(page);

    // Create a task due today via the Tasks module.
    await page.getByRole("link", { name: "Tasks", exact: true }).click();
    await page.getByRole("button", { name: "New task" }).click();
    await page.getByLabel("Title").fill("Calendar-linked task");
    await page.getByLabel("Due date").fill(new Date().toISOString().slice(0, 10));
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByText("Calendar-linked task")).toBeVisible();

    await page.getByRole("link", { name: "Calendar", exact: true }).click();
    await expect(page.getByText("Calendar-linked task")).toBeVisible();
  });

  test("AI scheduling degrades gracefully without a provider", async ({ page }) => {
    await registerAndOpenCalendar(page);

    await page.getByRole("button", { name: "Schedule with AI" }).click();
    await page.getByLabel("Describe what to schedule").fill("Dentist next Tuesday at 3pm");
    await page.getByRole("button", { name: "Schedule events" }).click();

    await expect(page.getByRole("alert")).toContainText(/GEMINI_API_KEY|provider/i);
  });
});
