import { expect, test, type Page } from "./fixtures";

/**
 * Documents journey against the LOCAL storage driver (no R2 in dev/CI).
 * Each test uploads exactly ONE file to avoid sequential upload timeout
 * accumulation under CI load (each cycle: create → PUT → finalize).
 */

const password = "a sufficiently long password";

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const TEXT_BYTES = Buffer.from("meeting notes: ship the documents module\n", "utf-8");

function uniqueEmail(): string {
  return `e2e-docs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

async function registerAndOpenDocuments(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Docs Tester");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(page).toHaveURL(/\/documents/);
}

async function uploadOneFile(
  page: Page,
  name: string,
  mimeType: string,
  buffer: Buffer,
): Promise<void> {
  await page.getByLabel("Choose files to upload").setInputFiles([{ name, mimeType, buffer }]);
  await expect(page.getByText(name)).toBeVisible({ timeout: 40_000 });
}

test.describe("documents", () => {
  test("uploads an image and filters by kind and name", async ({ page }) => {
    test.setTimeout(180_000);
    await registerAndOpenDocuments(page);
    await expect(page.getByText("No files yet — upload or drop something here.")).toBeVisible();

    await uploadOneFile(page, "pixel.png", "image/png", PNG_BYTES);

    await page.getByRole("button", { name: "Images" }).click();
    await expect(page.getByText("pixel.png")).toBeVisible();

    await page.getByRole("button", { name: "All files" }).click();
    await page.getByLabel("Search files").fill("pixel");
    await expect(page.getByText("pixel.png")).toBeVisible();
    await page.getByLabel("Search files").fill("nomatch");
    await expect(page.getByText("Nothing matches this filter.")).toBeVisible();
  });

  test("previews an image through the authenticated file endpoint", async ({ page }) => {
    test.setTimeout(180_000);
    await registerAndOpenDocuments(page);
    await uploadOneFile(page, "pixel.png", "image/png", PNG_BYTES);

    // Click the file name button to open the preview dialog.
    await page.getByRole("button", { name: "pixel.png", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    const image = dialog.locator("img[src*='/api/files/']");
    await expect(image).toBeVisible();
    await expect
      .poll(async () => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await page.keyboard.press("Escape");
  });

  test("renames and deletes a text file", async ({ page }) => {
    test.setTimeout(180_000);
    await registerAndOpenDocuments(page);
    await uploadOneFile(page, "notes.txt", "text/plain", TEXT_BYTES);

    await page.getByRole("button", { name: "Actions for notes.txt" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByLabel("New file name").fill("q3-notes.txt");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("q3-notes.txt")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Actions for q3-notes.txt" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("q3-notes.txt")).not.toBeVisible();
    await expect(page.getByText("No files yet — upload or drop something here.")).toBeVisible();
  });
});
