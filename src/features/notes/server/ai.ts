import "server-only";

import { AppError } from "@/lib/errors";
import { completeWithRetry } from "@/services/ai";

import type { RewriteTone } from "../types";
import { getNoteText } from "./service";

/** AI helpers for notes — plain-text completions through the gateway. */

export async function summarizeNote(userId: string, noteId: string): Promise<string> {
  const text = await getNoteText(userId, noteId);
  if (text.trim().length < 40) {
    throw new AppError("This note is too short to summarize.", {
      code: "VALIDATION",
      status: 400,
    });
  }

  const completion = await completeWithRetry({
    messages: [
      {
        role: "system",
        content:
          "You summarize personal notes. Produce a tight summary in the note's own language: 2-4 sentences, or up to 5 short bullet lines starting with '- ' when the note is list-like. No preamble, no headings — output the summary only.",
      },
      { role: "user", content: text.slice(0, 24_000) },
    ],
    temperature: 0.3,
    maxOutputTokens: 400,
  });

  const summary = completion.text.trim();
  if (!summary) {
    throw new AppError("The AI returned an empty summary — try again.", {
      code: "AI_PROVIDER",
      status: 502,
    });
  }
  return summary;
}

export async function rewriteText(text: string, tone: RewriteTone): Promise<string> {
  const completion = await completeWithRetry({
    messages: [
      {
        role: "system",
        content: `You rewrite passages of personal notes. Rewrite the user's text to be ${tone}, preserving its meaning, language and factual content. Output ONLY the rewritten text — no quotes, no commentary.`,
      },
      { role: "user", content: text },
    ],
    temperature: 0.4,
    maxOutputTokens: 1200,
  });

  const rewritten = completion.text.trim();
  if (!rewritten) {
    throw new AppError("The AI returned an empty rewrite — try again.", {
      code: "AI_PROVIDER",
      status: 502,
    });
  }
  return rewritten;
}
