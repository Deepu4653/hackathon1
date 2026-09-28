/**
 * Gemini API client (Google AI Studio, REST).
 *
 * Responsibilities kept here — and nowhere else:
 *   • credential checks with a clear "not configured" error,
 *   • request timeouts,
 *   • retries with backoff for transient failures / rate limits,
 *   • normalising every failure into one of three typed errors so the UI can
 *     show a useful message instead of a raw exception.
 */

import { serverEnv } from "@/lib/env.server";

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not configured.");
    this.name = "GeminiNotConfiguredError";
  }
}

export class GeminiRateLimitError extends Error {
  constructor() {
    super("The AI service is rate limited right now.");
    this.name = "GeminiRateLimitError";
  }
}

export class GeminiUnavailableError extends Error {
  constructor(message = "The AI service is temporarily unavailable.") {
    super(message);
    this.name = "GeminiUnavailableError";
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(serverEnv.geminiApiKey);
}

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

export interface GenerateOptions {
  model?: string;
  systemInstruction?: string;
  contents: GeminiContent[];
  temperature?: number;
  maxOutputTokens?: number;
  /** When set, Gemini is asked for strict JSON and the raw text is parsed. */
  jsonSchema?: Record<string, unknown>;
  timeoutMs?: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { totalTokenCount?: number };
  error?: { message?: string; status?: string; code?: number };
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  attempt = 0,
): Promise<GeminiResponse> {
  if (!isGeminiConfigured()) throw new GeminiNotConfiguredError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${serverEnv.geminiApiBase}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": serverEnv.geminiApiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (response.status === 429 && attempt < 2) {
      await sleep(800 * (attempt + 1));
      return callGemini(model, body, timeoutMs, attempt + 1);
    }
    if (RETRYABLE_STATUS.has(response.status) && attempt < 2) {
      await sleep(500 * (attempt + 1));
      return callGemini(model, body, timeoutMs, attempt + 1);
    }
    if (response.status === 429) throw new GeminiRateLimitError();
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new GeminiUnavailableError(
        `The AI service returned an error (${response.status}). ${text.slice(0, 180)}`,
      );
    }

    return (await response.json()) as GeminiResponse;
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError || error instanceof GeminiRateLimitError) throw error;
    if (error instanceof GeminiUnavailableError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GeminiUnavailableError("The AI request timed out. Please try again.");
    }
    if (attempt < 2) {
      await sleep(500 * (attempt + 1));
      return callGemini(model, body, timeoutMs, attempt + 1);
    }
    throw new GeminiUnavailableError(
      error instanceof Error ? `Could not reach the AI service: ${error.message}` : undefined,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Returns the model's text answer. Throws typed errors on failure. */
export async function generateText(options: GenerateOptions): Promise<string> {
  const model = options.model ?? serverEnv.geminiModel;
  const body: Record<string, unknown> = {
    contents: options.contents,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
      ...(options.jsonSchema ? { responseMimeType: "application/json", responseSchema: options.jsonSchema } : {}),
    },
  };
  if (options.systemInstruction) {
    body.systemInstruction = { parts: [{ text: options.systemInstruction }] };
  }

  const result = await callGemini(model, body, options.timeoutMs ?? 45_000);

  if (result.promptFeedback?.blockReason) {
    throw new GeminiUnavailableError(
      "That request was blocked by the AI safety filter. Please rephrase your question.",
    );
  }

  const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new GeminiUnavailableError("The AI service returned an empty answer. Please try again.");
  }
  return text;
}

/** Strips ```json fences that models sometimes add around JSON output. */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFence.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
