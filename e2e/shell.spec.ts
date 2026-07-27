import { expect, test, type Page } from "./fixtures";

/** App shell journey: sidebar, command palette, theme, user menu. */

const password = "a sufficiently long password";

function uniqueEmail(): string {
  return `e2e-shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

async function registerFreshUser(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Shell Tester");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("app shell", () => {
  test("shows the sidebar module map with live and upcoming entries", async ({ page }) => {
    await registerFreshUser(page);

    const sidebar = page.getByRole("navigation").first();
    await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tasks", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Calendar", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Notes", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Documents", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Finance", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Habits", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Health", exact: true })).toBeVisible();
    // Unshipped modules are visible but disabled.
    const shoppingButton = page.getByRole("button", { name: /Shopping/ });
    await expect(shoppingButton).toBeVisible();
    await expect(shoppingButton).toBeDisabled();
    void sidebar;
  });

  test("opens the command palette with the keyboard and switches theme", async ({ page }) => {
    await registerFreshUser(page);

    await page.keyboard.press("ControlOrMeta+k");
    const paletteInput = page.getByPlaceholder("Search or jump to…");
    await expect(paletteInput).toBeVisible();

    await paletteInput.fill("dark");
    await page.getByRole("option", { name: /Dark theme/ }).click();

    await expect(paletteInput).not.toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("renders dashboard widgets and signs out from the user menu", async ({ page }) => {
    await registerFreshUser(page);

    await expect(page.getByText(/, Shell/)).toBeVisible();
    await expect(page.getByText("Quick actions")).toBeVisible();
    await expect(page.getByText(/8 of 12 live/)).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
