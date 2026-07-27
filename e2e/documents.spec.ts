import { expect, test, type Page } from "./fixtures";

/**
 * Documents journey against the LOCAL storage driver (no R2 in dev/CI):
 * the exact same create → PUT → finalize flow production uses, with bytes
 * landing on disk instead of R2.
 */

const password = "a sufficiently long password";

// Smallest valid PNG (1×1) — a real binary upload, not a fixture on disk.
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

async function uploadFiles(page: Page): Promise<void> {
  await page.getByLabel("Choose files to upload").setInputFiles([
    { name: "pixel.png", mimeType: "image/png", buffer: PNG_BYTES },
    { name: "notes.txt", mimeType: "text/plain", buffer: TEXT_BYTES },
  ]);
  // Both files go create → PUT bytes → finalize; rows appear via revalidation.
  await expect(page.getByText("pixel.png")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("notes.txt")).toBeVisible({ timeout: 15_000 });
}

test.describe("documents", () => {
  test("uploads files end-to-end and filters them by kind", async ({ page }) => {
    await registerAndOpenDocuments(page);
    await expect(page.getByText("No files yet — upload or drop something here.")).toBeVisible();

    await uploadFiles(page);

    // Kind filters narrow the list.
    await page.getByRole("button", { name: "Images" }).click();
    await expect(page.getByText("pixel.png")).toBeVisible();
    await expect(page.getByText("notes.txt")).not.toBeVisible();

    await page.getByRole("button", { name: "Documents", exact: true }).click();
    await expect(page.getByText("notes.txt")).toBeVisible();
    await expect(page.getByText("pixel.png")).not.toBeVisible();

    await page.getByRole("button", { name: "All files" }).click();

    // Search matches names.
    await page.getByLabel("Search files").fill("pixel");
    await expect(page.getByText("pixel.png")).toBeVisible();
    await expect(page.getByText("notes.txt")).not.toBeVisible();
  });

  test("previews an image through the authenticated file endpoint", async ({ page }) => {
    await registerAndOpenDocuments(page);
    await uploadFiles(page);

    await page.getByText("pixel.png").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const image = dialog.locator("img[src*='/api/files/']");
    await expect(image).toBeVisible();
    // The endpoint actually serves the bytes (naturalWidth > 0 = decoded).
    await expect
      .poll(async () => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await page.keyboard.press("Escape");
  });

  test("renames and deletes files", async ({ page }) => {
    await registerAndOpenDocuments(page);
    await uploadFiles(page);

    await page.getByRole("button", { name: "Actions for notes.txt" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByLabel("New file name").fill("q3-meeting-notes.txt");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("q3-meeting-notes.txt")).toBeVisible();

    await page.getByRole("button", { name: "Actions for pixel.png" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    // The confirm dialog (whose description quotes the name) closes first.
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("pixel.png", { exact: true })).not.toBeVisible();
    await expect(page.getByText("q3-meeting-notes.txt")).toBeVisible();
  });
});
