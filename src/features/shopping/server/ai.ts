import "server-only";

import { AppError } from "@/lib/errors";
import { completeWithRetry } from "@/services/ai";

import type { ItemSuggestionDto } from "../types";

const SYSTEM_PROMPT = `You are a smart shopping assistant. Suggest items for a shopping list.

Respond with ONLY valid JSON:
{"items":[{"name":"...","quantity":1,"unit":""}]}

Rules:
- name: concise item name, max 60 chars (in the user's language — Vietnamese or English)
- quantity: sensible default (e.g. 2 for eggs → 12, milk → 2 liters)
- unit: "kg", "g", "L", "ml", "chai", "hộp", "gói", "cái", "bó" etc., or "" for countable items
- Suggest 5-12 items relevant to the context
- Do NOT suggest items already in the list
- No markdown, no commentary — JSON only`;

export async function suggestShoppingItems(
  listName: string,
  description: string,
  existingItems: string[],
  prompt: string,
): Promise<ItemSuggestionDto[]> {
  const payload = JSON.stringify({
    listName,
    description: description || undefined,
    existingItems: existingItems.length > 0 ? existingItems : undefined,
    userRequest: prompt,
  });

  const completion = await completeWithRetry({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: payload },
    ],
    jsonMode: true,
    temperature: 0.4,
    maxOutputTokens: 600,
  });

  let parsed: unknown;
  try {
    const raw = completion.text
      .trim()
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "");
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError("The AI returned malformed JSON — try again.", {
      code: "AI_PROVIDER",
      status: 502,
    });
  }

  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("The AI didn't suggest any items — try again.", {
      code: "AI_PROVIDER",
      status: 502,
    });
  }

  return items
    .filter(
      (item): item is ItemSuggestionDto =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).name === "string",
    )
    .slice(0, 20)
    .map((item) => ({
      name: String(item.name).trim().slice(0, 100),
      quantity: typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1,
      unit: typeof item.unit === "string" ? item.unit.trim().slice(0, 20) : "",
    }));
}
