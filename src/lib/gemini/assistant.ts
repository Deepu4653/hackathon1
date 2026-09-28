import { z } from "zod";
import type { Language } from "@/lib/db/types";
import { generateText, isGeminiConfigured, GeminiNotConfiguredError } from "./client";
import { assistantSystemPrompt } from "./prompts";

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskAssistantInput {
  question: string;
  language: Language;
  contextBlock: string;
  history?: AssistantTurn[];
}

export interface AssistantAnswer {
  ok: true;
  answer: string;
  model: string;
}
export interface AssistantFailure {
  ok: false;
  reason: "not_configured" | "rate_limited" | "unavailable" | "invalid";
  message: string;
}

const questionSchema = z.string().trim().min(2).max(1500);

export async function askAssistant(input: AskAssistantInput): Promise<AssistantAnswer | AssistantFailure> {
  if (!isGeminiConfigured()) return { ok: false, reason: "not_configured", message: "not_configured" };

  const parsed = questionSchema.safeParse(input.question);
  if (!parsed.success) {
    return { ok: false, reason: "invalid", message: "Please write a slightly longer question." };
  }

  const history = (input.history ?? [])
    .slice(-6)
    .map((turn) => ({
      role: turn.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: turn.content.slice(0, 2000) }],
    }));

  try {
    const answer = await generateText({
      systemInstruction: assistantSystemPrompt(input.language, input.contextBlock),
      contents: [...history, { role: "user", parts: [{ text: parsed.data }] }],
      temperature: 0.35,
      maxOutputTokens: 1600,
    });
    return { ok: true, answer: answer.trim(), model: "gemini" };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof GeminiNotConfiguredError
          ? "not_configured"
          : error instanceof Error && error.name === "GeminiRateLimitError"
            ? "rate_limited"
            : "unavailable",
      message: error instanceof Error ? error.message : "AI analysis could not be completed.",
    };
  }
}
