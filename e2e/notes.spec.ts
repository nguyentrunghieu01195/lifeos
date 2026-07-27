import { expect, test, type Page } from "./fixtures";

/** Notes module journey: editor with autosave, folders/tags, AI degradation. */

const password = "a sufficiently long password";

function uniqueEmail(): string {
  return `e2e-notes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@lifeos.test`;
}

async function registerAndOpenNotes(page: Page): Promise<void> {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Notes Tester");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("link", { name: "Notes", exact: true }).click();
  await expect(page).toHaveURL(/\/notes/);
}

async function createNote(page: Page): Promise<void> {
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page).toHaveURL(/\/notes\/[a-z0-9]+/);
  await expect(page.locator(".tiptap")).toBeVisible();
}

test.describe("notes", () => {
  test("writes a note with markdown shortcuts, autosaves and persists it", async ({ page }) => {
    await registerAndOpenNotes(page);
    await createNote(page);

    await page.getByLabel("Note title").fill("Meeting recap");

    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("# Decisions");
    await page.keyboard.press("Enter");
    await page.keyboard.type("- Ship the notes module");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Everyone agreed on the rollout plan.");

    // Markdown input rules produced real structure.
    await expect(editor.locator("h1")).toContainText("Decisions");
    await expect(editor.locator("ul li").first()).toContainText("Ship the notes module");

    // Debounced autosave lands without any explicit save button.
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

    // The list shows title + preview, and reopening restores the content.
    await page.getByRole("link", { name: "Notes", exact: true }).click();
    await expect(page).toHaveURL(/\/notes$/);
    await page.getByText("Meeting recap").click();
    await expect(page.locator(".tiptap h1")).toContainText("Decisions");
    await expect(page.getByLabel("Note title")).toHaveValue("Meeting recap");
  });

  test("organizes notes with folders and tags", async ({ page }) => {
    await registerAndOpenNotes(page);

    // Create a folder and select it so the next note lands inside.
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("New folder name").fill("Journal");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Journal" }).click();

    await createNote(page);
    await expect(page.getByRole("combobox", { name: "Folder" })).toContainText("Journal");

    // Tag it from the editor.
    await page.getByRole("button", { name: /Tags/ }).click();
    await page.getByLabel("New tag name").fill("personal");
    await page.getByRole("button", { name: "Add tag" }).click();
    await expect(page.getByRole("checkbox", { name: "Tag personal" })).toBeChecked();
    await page.keyboard.press("Escape");

    await page.getByLabel("Note title").fill("Morning pages");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

    // Folder filter on the list narrows to this note.
    await page.getByRole("link", { name: "Notes", exact: true }).click();
    await page.getByRole("button", { name: "Journal" }).click();
    await expect(page.getByText("Morning pages")).toBeVisible();
  });

  test("AI summarize degrades gracefully and notes can be deleted", async ({ page }) => {
    await registerAndOpenNotes(page);
    await createNote(page);

    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type(
      "The quarterly planning meeting covered hiring, the product roadmap and budget priorities for the next two quarters.",
    );
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });

    // No AI provider is configured in CI — the failure must be a friendly message.
    await page.getByRole("button", { name: "AI", exact: true }).click();
    await page.getByRole("menuitem", { name: "Summarize note" }).click();
    await expect(page.getByText(/GEMINI_API_KEY|provider/i)).toBeVisible({ timeout: 15_000 });

    // Two-step delete returns to the list.
    await page.getByRole("button", { name: "Delete note", exact: true }).click();
    await page.getByRole("button", { name: "Confirm delete note" }).click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(page.getByText("No notes yet — capture your first thought.")).toBeVisible();
  });
});
