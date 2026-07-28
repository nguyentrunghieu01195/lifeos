import "server-only";

import type { Decimal } from "@prisma/client/runtime/library";

import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

import type { AddItemInput, CreateListInput, UpdateItemInput } from "../schemas";
import type {
  ShoppingDashboardDto,
  ShoppingItemDto,
  ShoppingListDetailDto,
  ShoppingListDto,
} from "../types";

/** Shopping domain service — every read/write scoped to the explicit userId. */

const d = (v: Decimal) => Number(v);

function toItemDto(row: {
  id: string;
  listId: string;
  name: string;
  quantity: Decimal;
  unit: string;
  priceMinor: number | null;
  isChecked: boolean;
  sortOrder: number;
}): ShoppingItemDto {
  return {
    id: row.id,
    listId: row.listId,
    name: row.name,
    quantity: d(row.quantity),
    unit: row.unit,
    priceMinor: row.priceMinor,
    isChecked: row.isChecked,
    sortOrder: row.sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export async function listShoppingLists(userId: string): Promise<ShoppingListDto[]> {
  const lists = await getDb().shoppingList.findMany({
    where: { userId, isArchived: false },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      _count: { select: { items: true } },
      items: { where: { isChecked: true }, select: { id: true } },
    },
  });

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    totalItems: list._count.items,
    checkedItems: list.items.length,
    createdAt: list.createdAt.toISOString(),
  }));
}

export async function getShoppingList(
  userId: string,
  listId: string,
): Promise<ShoppingListDetailDto> {
  const list = await getDb().shoppingList.findFirst({
    where: { id: listId, userId, isArchived: false },
    include: {
      items: {
        orderBy: [{ isChecked: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!list) {
    throw new AppError("Shopping list not found.", { code: "NOT_FOUND", status: 404 });
  }

  const items = list.items.map(toItemDto);
  const totalPriceMinor = items
    .filter((item) => !item.isChecked && item.priceMinor !== null)
    .reduce((acc, item) => acc + item.priceMinor! * item.quantity, 0);

  return {
    id: list.id,
    name: list.name,
    description: list.description,
    totalItems: items.length,
    checkedItems: items.filter((item) => item.isChecked).length,
    createdAt: list.createdAt.toISOString(),
    items,
    totalPriceMinor: Math.round(totalPriceMinor),
  };
}

export async function createShoppingList(
  userId: string,
  input: CreateListInput,
): Promise<ShoppingListDto> {
  const list = await getDb().shoppingList.create({
    data: { userId, name: input.name, description: input.description },
  });
  return { ...list, totalItems: 0, checkedItems: 0, createdAt: list.createdAt.toISOString() };
}

export async function updateShoppingList(
  userId: string,
  id: string,
  input: { name?: string; description?: string },
): Promise<void> {
  const result = await getDb().shoppingList.updateMany({
    where: { id, userId },
    data: input,
  });
  if (result.count === 0) {
    throw new AppError("Shopping list not found.", { code: "NOT_FOUND", status: 404 });
  }
}

export async function archiveShoppingList(userId: string, id: string): Promise<void> {
  const result = await getDb().shoppingList.updateMany({
    where: { id, userId },
    data: { isArchived: true },
  });
  if (result.count === 0) {
    throw new AppError("Shopping list not found.", { code: "NOT_FOUND", status: 404 });
  }
}

/** Uncheck all items in a list (reset for reuse). */
export async function resetShoppingList(userId: string, listId: string): Promise<void> {
  const list = await getDb().shoppingList.findFirst({ where: { id: listId, userId } });
  if (!list) {
    throw new AppError("Shopping list not found.", { code: "NOT_FOUND", status: 404 });
  }
  await getDb().shoppingItem.updateMany({
    where: { listId, userId },
    data: { isChecked: false },
  });
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function addItem(userId: string, input: AddItemInput): Promise<ShoppingItemDto> {
  // Verify ownership of the list.
  const list = await getDb().shoppingList.findFirst({ where: { id: input.listId, userId } });
  if (!list) {
    throw new AppError("Shopping list not found.", { code: "NOT_FOUND", status: 404 });
  }

  // Place new item after the current last unchecked item.
  const maxOrder = await getDb().shoppingItem.aggregate({
    where: { listId: input.listId, isChecked: false },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  const row = await getDb().shoppingItem.create({
    data: {
      listId: input.listId,
      userId,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      priceMinor: input.priceMinor,
      sortOrder,
    },
  });
  return toItemDto(row);
}

export async function updateItem(userId: string, input: UpdateItemInput): Promise<ShoppingItemDto> {
  const existing = await getDb().shoppingItem.findFirst({
    where: { id: input.id, userId },
  });
  if (!existing) {
    throw new AppError("Item not found.", { code: "NOT_FOUND", status: 404 });
  }

  const { id, ...data } = input;
  const row = await getDb().shoppingItem.update({ where: { id }, data });
  return toItemDto(row);
}

export async function toggleItem(userId: string, itemId: string): Promise<boolean> {
  const item = await getDb().shoppingItem.findFirst({
    where: { id: itemId, userId },
    select: { id: true, isChecked: true },
  });
  if (!item) {
    throw new AppError("Item not found.", { code: "NOT_FOUND", status: 404 });
  }

  const next = !item.isChecked;
  await getDb().shoppingItem.update({
    where: { id: item.id },
    data: { isChecked: next },
  });
  return next;
}

export async function deleteItem(userId: string, itemId: string): Promise<void> {
  const result = await getDb().shoppingItem.deleteMany({
    where: { id: itemId, userId },
  });
  if (result.count === 0) {
    throw new AppError("Item not found.", { code: "NOT_FOUND", status: 404 });
  }
}

export async function bulkAddItems(
  userId: string,
  listId: string,
  items: Array<{ name: string; quantity: number; unit: string }>,
): Promise<void> {
  const list = await getDb().shoppingList.findFirst({ where: { id: listId, userId } });
  if (!list) {
    throw new AppError("Shopping list not found.", { code: "NOT_FOUND", status: 404 });
  }

  const maxOrder = await getDb().shoppingItem.aggregate({
    where: { listId, isChecked: false },
    _max: { sortOrder: true },
  });
  let nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

  await getDb().shoppingItem.createMany({
    data: items.map((item) => ({
      listId,
      userId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      sortOrder: nextOrder++,
    })),
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getShoppingDashboard(userId: string): Promise<ShoppingDashboardDto> {
  const lists = await getDb().shoppingList.findMany({
    where: { userId, isArchived: false },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      _count: { select: { items: true } },
      items: { where: { isChecked: true }, select: { id: true } },
    },
  });

  return {
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      totalItems: list._count.items,
      checkedItems: list.items.length,
    })),
  };
}

// ---------------------------------------------------------------------------
// AI helper
// ---------------------------------------------------------------------------

export async function getListContext(
  userId: string,
  listId: string,
): Promise<{ name: string; description: string; existingItems: string[] }> {
  const list = await getDb().shoppingList.findFirst({
    where: { id: listId, userId },
    select: { name: true, description: true, items: { select: { name: true } } },
  });
  if (!list) {
    throw new AppError("Shopping list not found.", { code: "NOT_FOUND", status: 404 });
  }
  return {
    name: list.name,
    description: list.description,
    existingItems: list.items.map((item) => item.name),
  };
}
