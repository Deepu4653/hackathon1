import { z } from "zod";
import type { Language } from "@/lib/db/types";
import { extractJson, generateText, isGeminiConfigured, GeminiNotConfiguredError } from "./client";
import { VISION_RESPONSE_SCHEMA, visionSystemPrompt } from "./prompts";
import { serverEnv } from "@/lib/env.server";

export const cropAnalysisResultSchema = z.object({
  isPlantImage: z.boolean(),
  possibleProblem: z.string().min(1).max(600),
  visibleSymptoms: z.array(z.string().min(1).max(300)).max(12),
  confidence: z.enum(["low", "medium", "high"]),
  severity: z.enum(["low", "moderate", "high", "unknown"]),
  nextSteps: z.array(z.string().min(1).max(400)).max(12),
  prevention: z.array(z.string().min(1).max(400)).max(12),
  uncertaintyNote: z.string().max(600),
});

export type CropAnalysisResult = z.infer<typeof cropAnalysisResultSchema>;

export interface AnalyseImageInput {
  imageBase64: string;
  mimeType: string;
  cropName?: string | null;
  language: Language;
  notes?: string | null;
  contextBlock?: string;
}

export type AnalyseImageOutcome =
  | { ok: true; result: CropAnalysisResult; model: string; raw: unknown }
  | {
      ok: false;
      reason: "not_configured" | "rate_limited" | "unavailable" | "invalid_response" | "not_a_plant";
      message: string;
      raw?: unknown;
    };

export async function analyseCropImage(input: AnalyseImageInput): Promise<AnalyseImageOutcome> {
  if (!isGeminiConfigured()) {
    return { ok: false, reason: "not_configured", message: "Photo analysis is not configured on this deployment." };
  }

  const promptParts = [
    "Analyse this crop photograph and reply with the required JSON object.",
    input.cropName ? `The farmer says this is: ${input.cropName}.` : "The farmer did not name the crop.",
    input.notes ? `Farmer's note: ${input.notes.slice(0, 400)}` : "",
    input.contextBlock ? `Farm context:\n${input.contextBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generateText({
      model: serverEnv.geminiVisionModel,
      systemInstruction: visionSystemPrompt(input.language),
      contents: [
        {
          role: "user",
          parts: [
            { text: promptParts },
            { inlineData: { mimeType: input.mimeType, data: input.imageBase64 } },
          ],
        },
      ],
      temperature: 0.15,
      maxOutputTokens: 1400,
      jsonSchema: VISION_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      timeoutMs: 60_000,
    });

    const parsedJson = extractJson(raw);
    const validated = cropAnalysisResultSchema.safeParse(parsedJson);
    if (!validated.success) {
      return {
        ok: false,
        reason: "invalid_response",
        message: "The AI could not analyse that photo clearly. Please try a closer, well-lit photo.",
        raw,
      };
    }

    if (!validated.data.isPlantImage) {
      return {
        ok: false,
        reason: "not_a_plant",
        message:
          "This does not look like a photo of a plant or leaf. Please upload a close-up of the affected part of the crop.",
        raw: validated.data,
      };
    }

    return { ok: true, result: validated.data, model: serverEnv.geminiVisionModel, raw: validated.data };
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
