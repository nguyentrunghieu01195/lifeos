import { expect, test } from "@playwright/test";

/**
 * End-to-end authentication flow against the production server with a real
 * database (CI provides a Postgres service; locally run `pnpm db:local`).
 */

const password = "a sufficiently long password";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

test.describe("authentication", () => {
  test("redirects anonymous visitors from the dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("registers, lands on the dashboard, signs out and back in", async ({ page }) => {
    const email = uniqueEmail();

    // Register
    await page.goto("/register");
    await page.getByLabel("Name").fill("E2E Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Sign out
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);

    // Sign back in
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /Welcome, E2E/ })).toBeVisible();
  });

  test("shows one identical error for wrong password and unknown email", async ({ page }) => {
    const email = uniqueEmail();

    // Register a real account first.
    await page.goto("/register");
    await page.getByLabel("Name").fill("E2E Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);

    // Wrong password
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrong password entirely");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Note: Next.js injects an empty route-announcer with role="alert", so the
    // assertion targets the visible message text itself.
    await expect(page.getByText("Invalid email or password.", { exact: true })).toBeVisible();

    // Unknown email — identical message (no user enumeration)
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password.", { exact: true })).toBeVisible();
  });
});
