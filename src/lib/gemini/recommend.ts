import { z } from "zod";
import { extractJson, generateText, isGeminiConfigured, GeminiNotConfiguredError } from "./client";
import { RECOMMENDATION_RESPONSE_SCHEMA, recommendationSystemPrompt } from "./prompts";

export const recommendationInputSchema = z.object({
  location: z.string().trim().min(2).max(120),
  season: z.enum(["kharif", "rabi", "zaid", "perennial"]),
  soilType: z.string().trim().max(80).optional(),
  ph: z.number().min(0).max(14).optional(),
  waterAvailability: z.enum(["low", "medium", "high"]),
  farmSizeAcres: z.number().min(0).max(100000).optional(),
  previousCrop: z.string().trim().max(80).optional(),
  preference: z.enum(["food", "cash", "pulse", "oilseed", "any"]).default("any"),
  language: z.enum(["en", "te", "hi"]).default("en"),
  notes: z.string().trim().max(400).optional(),
});

export type RecommendationInput = z.infer<typeof recommendationInputSchema>;

const recommendationResultSchema = z.object({
  recommendations: z
    .array(
      z.object({
        cropName: z.string().min(1).max(120),
        suitability: z.enum(["best", "good", "possible"]),
        reasoning: z.string().min(1).max(800),
        considerations: z.array(z.string().min(1).max(300)).max(8),
        growingInfo: z.object({
          season: z.string().max(120),
          durationDays: z.string().max(60),
          waterNeed: z.string().max(60),
          sowingWindow: z.string().max(120),
          spacingOrSeedRate: z.string().max(120).optional(),
        }),
      }),
    )
    .min(1)
    .max(6),
  generalAdvice: z.string().max(900),
  uncertainties: z.array(z.string().max(300)).max(8),
});

export type RecommendationResult = z.infer<typeof recommendationResultSchema>;

export type RecommendationOutcome =
  | { ok: true; result: RecommendationResult }
  | { ok: false; reason: "not_configured" | "rate_limited" | "unavailable" | "invalid_response"; message: string };

export async function recommendCrops(
  input: RecommendationInput,
): Promise<RecommendationOutcome> {
  if (!isGeminiConfigured()) {
    return { ok: false, reason: "not_configured", message: "Crop advice needs GEMINI_API_KEY." };
  }

  const facts = [
    `Location: ${input.location}`,
    `Season: ${input.season}`,
    `Water availability: ${input.waterAvailability}`,
    input.soilType ? `Soil type: ${input.soilType}` : "Soil type: not provided",
    input.ph !== undefined ? `Soil pH: ${input.ph}` : "Soil pH: unknown — do not assume it",
    input.farmSizeAcres !== undefined ? `Farm size: ${input.farmSizeAcres} acres` : "Farm size: not provided",
    input.previousCrop ? `Previous crop: ${input.previousCrop}` : "Previous crop: not provided",
    `Farmer preference: ${input.preference}`,
    input.notes ? `Notes: ${input.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generateText({
      systemInstruction: recommendationSystemPrompt(input.language),
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Suggest crops for these exact conditions. Reply only with the JSON object described by the schema.\n\n${facts}`,
            },
          ],
        },
      ],
      temperature: 0.25,
      maxOutputTokens: 2200,
      jsonSchema: RECOMMENDATION_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
      timeoutMs: 60_000,
    });

    const validated = recommendationResultSchema.safeParse(extractJson(raw));
    if (!validated.success) {
      return {
        ok: false,
        reason: "invalid_response",
        message: "The suggestion could not be prepared properly. Please try again.",
      };
    }
    return { ok: true, result: validated.data };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof GeminiNotConfiguredError
          ? "not_configured"
          : error instanceof Error && error.name === "GeminiRateLimitError"
            ? "rate_limited"
            : "unavailable",
      message: error instanceof Error ? error.message : "Recommendation failed.",
    };
  }
}
