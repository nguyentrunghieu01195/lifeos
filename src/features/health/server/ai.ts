import "server-only";

import { AppError } from "@/lib/errors";
import { completeWithRetry } from "@/services/ai";

import { getHealthDataForAI } from "./service";

export async function analyzeHealth(userId: string): Promise<string> {
  const data = await getHealthDataForAI(userId);

  if (data === "No health data recorded yet.") {
    throw new AppError("Log some health data first — there's nothing to analyse yet.", {
      code: "VALIDATION",
      status: 400,
    });
  }

  const completion = await completeWithRetry({
    messages: [
      {
        role: "system",
        content: `You are a supportive personal health coach. Analyse the user's health data and give a concise, helpful summary.

Write 3-5 short bullet points:
- Identify clear trends (positive or concerning)
- Note what's going well
- Give 1-2 specific, actionable suggestions
- Be encouraging, not alarming
- Respond in the same language the user logs in (Vietnamese or English)
- No emojis in bullets, no markdown headers — just clean bullets starting with "•"`,
      },
      {
        role: "user",
        content: data,
      },
    ],
    temperature: 0.4,
    maxOutputTokens: 500,
  });

  const analysis = completion.text.trim();
  if (!analysis) {
    throw new AppError("The AI returned an empty analysis — try again.", {
      code: "AI_PROVIDER",
      status: 502,
    });
  }
  return analysis;
}
