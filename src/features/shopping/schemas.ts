import { z } from "zod";

export const createListSchema = z.object({
  name: z.string().trim().min(1, "List name is required.").max(80),
  description: z.string().trim().max(200).default(""),
});

export const updateListSchema = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(200).optional(),
});

export const addItemSchema = z.object({
  listId: z.string().cuid(),
  name: z.string().trim().min(1, "Item name is required.").max(100),
  quantity: z.number().positive().max(10_000).default(1),
  unit: z.string().trim().max(20).default(""),
  priceMinor: z.number().int().min(0).max(100_000_000).nullable().default(null),
});

export const updateItemSchema = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).max(100).optional(),
  quantity: z.number().positive().max(10_000).optional(),
  unit: z.string().trim().max(20).optional(),
  priceMinor: z.number().int().min(0).max(100_000_000).nullable().optional(),
});

export const suggestItemsSchema = z.object({
  listId: z.string().cuid(),
  prompt: z.string().trim().min(3, "Describe what you want to buy.").max(300),
});

export const bulkAddItemsSchema = z.object({
  listId: z.string().cuid(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        quantity: z.number().positive().max(10_000).default(1),
        unit: z.string().trim().max(20).default(""),
      }),
    )
    .min(1)
    .max(30),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
