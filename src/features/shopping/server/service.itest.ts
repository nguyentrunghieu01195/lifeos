import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";

import {
  addItem,
  archiveShoppingList,
  bulkAddItems,
  createShoppingList,
  deleteItem,
  getShoppingDashboard,
  getShoppingList,
  listShoppingLists,
  resetShoppingList,
  toggleItem,
  updateItem,
  updateShoppingList,
} from "./service";

const hasDatabase = Boolean(process.env.DATABASE_URL);

let userA = "";
let userB = "";

describe.runIf(hasDatabase)("shopping service (integration)", () => {
  beforeAll(async () => {
    const [a, b] = await Promise.all([
      getDb().user.create({ data: { email: `itest-shop-a-${crypto.randomUUID()}@lifeos.test` } }),
      getDb().user.create({ data: { email: `itest-shop-b-${crypto.randomUUID()}@lifeos.test` } }),
    ]);
    userA = a.id;
    userB = b.id;
  });

  afterAll(async () => {
    await getDb().user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("creates a list, adds items and shows progress", async () => {
    const list = await createShoppingList(userA, { name: "Groceries", description: "" });
    expect(list.totalItems).toBe(0);
    expect(list.checkedItems).toBe(0);

    await addItem(userA, {
      listId: list.id,
      name: "Apples",
      quantity: 3,
      unit: "kg",
      priceMinor: 60_000,
    });
    await addItem(userA, {
      listId: list.id,
      name: "Milk",
      quantity: 2,
      unit: "L",
      priceMinor: null,
    });

    const detail = await getShoppingList(userA, list.id);
    expect(detail.items).toHaveLength(2);
    expect(detail.totalItems).toBe(2);
    expect(detail.checkedItems).toBe(0);
    // Price only counts items with price set × quantity
    expect(detail.totalPriceMinor).toBe(180_000); // 60_000 × 3

    const lists = await listShoppingLists(userA);
    expect(lists.find((l) => l.id === list.id)?.totalItems).toBe(2);
  });

  it("toggles items and tracks progress", async () => {
    const list = await createShoppingList(userA, { name: "Toggle test", description: "" });
    const item = await addItem(userA, {
      listId: list.id,
      name: "Bread",
      quantity: 1,
      unit: "",
      priceMinor: null,
    });

    expect(await toggleItem(userA, item.id)).toBe(true); // now checked
    expect(await toggleItem(userA, item.id)).toBe(false); // unchecked again

    const detail = await getShoppingList(userA, list.id);
    expect(detail.checkedItems).toBe(0);
  });

  it("resets all items to unchecked", async () => {
    const list = await createShoppingList(userA, { name: "Reset test", description: "" });
    const a = await addItem(userA, {
      listId: list.id,
      name: "A",
      quantity: 1,
      unit: "",
      priceMinor: null,
    });
    const b = await addItem(userA, {
      listId: list.id,
      name: "B",
      quantity: 1,
      unit: "",
      priceMinor: null,
    });
    await toggleItem(userA, a.id);
    await toggleItem(userA, b.id);

    await resetShoppingList(userA, list.id);

    const detail = await getShoppingList(userA, list.id);
    expect(detail.checkedItems).toBe(0);
  });

  it("updates item fields", async () => {
    const list = await createShoppingList(userA, { name: "Update test", description: "" });
    const item = await addItem(userA, {
      listId: list.id,
      name: "Old name",
      quantity: 1,
      unit: "",
      priceMinor: null,
    });

    const updated = await updateItem(userA, {
      id: item.id,
      name: "New name",
      quantity: 2,
      priceMinor: 30_000,
    });
    expect(updated.name).toBe("New name");
    expect(updated.quantity).toBe(2);
    expect(updated.priceMinor).toBe(30_000);
  });

  it("deletes an item", async () => {
    const list = await createShoppingList(userA, { name: "Delete test", description: "" });
    const item = await addItem(userA, {
      listId: list.id,
      name: "To delete",
      quantity: 1,
      unit: "",
      priceMinor: null,
    });

    await deleteItem(userA, item.id);

    const detail = await getShoppingList(userA, list.id);
    expect(detail.items.find((i) => i.id === item.id)).toBeUndefined();
  });

  it("bulk-adds multiple items at once", async () => {
    const list = await createShoppingList(userA, { name: "Bulk test", description: "" });
    await bulkAddItems(userA, list.id, [
      { name: "Item 1", quantity: 1, unit: "" },
      { name: "Item 2", quantity: 2, unit: "kg" },
      { name: "Item 3", quantity: 3, unit: "" },
    ]);

    const detail = await getShoppingList(userA, list.id);
    expect(detail.items).toHaveLength(3);
  });

  it("archives a list and hides it from the main list", async () => {
    const list = await createShoppingList(userA, { name: "Archive me", description: "" });
    let lists = await listShoppingLists(userA);
    expect(lists.some((l) => l.id === list.id)).toBe(true);

    await archiveShoppingList(userA, list.id);

    lists = await listShoppingLists(userA);
    expect(lists.some((l) => l.id === list.id)).toBe(false);
    await expect(getShoppingList(userA, list.id)).rejects.toThrow("not found");
  });

  it("updates list name and description", async () => {
    const list = await createShoppingList(userA, { name: "Old name", description: "" });
    await updateShoppingList(userA, list.id, { name: "New name", description: "updated desc" });

    const detail = await getShoppingList(userA, list.id);
    expect(detail.name).toBe("New name");
    expect(detail.description).toBe("updated desc");
  });

  it("never exposes another user's data", async () => {
    const list = await createShoppingList(userA, { name: "Private", description: "" });
    const item = await addItem(userA, {
      listId: list.id,
      name: "Secret item",
      quantity: 1,
      unit: "",
      priceMinor: null,
    });

    await expect(getShoppingList(userB, list.id)).rejects.toThrow("not found");
    await expect(archiveShoppingList(userB, list.id)).rejects.toThrow("not found");
    await expect(toggleItem(userB, item.id)).rejects.toThrow("not found");
    await expect(deleteItem(userB, item.id)).rejects.toThrow("not found");

    const listsB = await listShoppingLists(userB);
    expect(listsB.some((l) => l.id === list.id)).toBe(false);
  });

  it("dashboard shows active lists with progress", async () => {
    const list = await createShoppingList(userB, { name: "Dashboard list", description: "" });
    const item = await addItem(userB, {
      listId: list.id,
      name: "X",
      quantity: 1,
      unit: "",
      priceMinor: null,
    });
    await toggleItem(userB, item.id);

    const data = await getShoppingDashboard(userB);
    const found = data.lists.find((l) => l.id === list.id);
    expect(found).toBeDefined();
    expect(found?.checkedItems).toBe(1);
    expect(found?.totalItems).toBe(1);
  });
});
