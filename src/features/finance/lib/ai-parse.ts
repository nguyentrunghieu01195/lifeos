/**
 * Parse + validate the AI categorization response. Pure so the strictness is
 * unit-testable: the model only ever gets to pick from real ids, and type
 * mismatches degrade to "no suggestion" rather than bad data.
 */

export interface SuggestionCandidate {
  transactionId: string;
  categoryId: string | null;
}

interface KnownTransaction {
  id: string;
  type: "INCOME" | "EXPENSE";
}

interface KnownCategory {
  id: string;
  type: "INCOME" | "EXPENSE";
}

export type ParseResult =
  { ok: true; suggestions: SuggestionCandidate[] } | { ok: false; error: string };

export function parseCategorySuggestions(
  raw: string,
  transactions: KnownTransaction[],
  categories: KnownCategory[],
): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return { ok: false, error: "The AI returned malformed JSON." };
  }

  const assignments = (parsed as { assignments?: unknown }).assignments;
  if (!Array.isArray(assignments)) {
    return { ok: false, error: "The AI response is missing assignments." };
  }

  const transactionById = new Map(transactions.map((entry) => [entry.id, entry]));
  const categoryById = new Map(categories.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const suggestions: SuggestionCandidate[] = [];

  for (const entry of assignments) {
    if (typeof entry !== "object" || entry === null) continue;
    const { transactionId, categoryId } = entry as {
      transactionId?: unknown;
      categoryId?: unknown;
    };
    if (typeof transactionId !== "string") continue;
    const transaction = transactionById.get(transactionId);
    if (!transaction || seen.has(transactionId)) continue;
    seen.add(transactionId);

    if (typeof categoryId !== "string") {
      suggestions.push({ transactionId, categoryId: null });
      continue;
    }
    const category = categoryById.get(categoryId);
    // Unknown ids and cross-type picks degrade to "no suggestion".
    suggestions.push({
      transactionId,
      categoryId: category && category.type === transaction.type ? category.id : null,
    });
  }

  if (suggestions.length === 0) {
    return { ok: false, error: "The AI response didn't reference any known transactions." };
  }
  return { ok: true, suggestions };
}

/** Tolerate models that wrap JSON in code fences despite instructions. */
function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
  return fenced?.[1] ?? trimmed;
}
