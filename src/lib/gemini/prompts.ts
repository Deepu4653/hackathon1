import type { Language } from "@/lib/db/types";

/**
 * Prompt construction.
 *
 * Three product rules are enforced in every prompt:
 *   1. Never invent weather, prices, soil values or test results.
 *   2. Never promise a yield, a profit or a cure.
 *   3. Say when something is uncertain, and point to a human expert for
 *      decisions that involve chemicals, money or crop loss.
 */

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  te: "Telugu (తెలుగు)",
  hi: "Hindi (हिन्दी)",
};

const SAFETY_RULES = `
HARD RULES (never break these):
- Use ONLY the farm context supplied below. Never invent weather values, market
  prices, soil test numbers, or pest incidence data.
- Never promise a yield, an income, or a guaranteed cure.
- If the answer depends on information you do not have (a lab test, a local
  price, a field inspection), say so plainly and name what is missing.
- Pesticide or fertiliser suggestions must be generic and safe: never invent
  brand names, never give exact chemical doses as if they were verified.
  Always advise confirming with the local agriculture officer / KVK / licensed
  dealer before spraying.
- Recommend integrated, low-risk steps first (monitoring, cultural practices,
  water management), then mention chemical options as a decision to confirm.
- Keep answers practical and short. Use short sentences and simple words.
- Use Indian units: acres, quintals, kg/acre.
`;

export function assistantSystemPrompt(language: Language, contextBlock: string): string {
  return `You are X-FARM AI, a careful agricultural adviser for small and marginal
farmers in India, especially Andhra Pradesh.

Answer in ${LANGUAGE_NAMES[language]}. Every sentence must be in that language.

${SAFETY_RULES}

${contextBlock ? `FARM CONTEXT (real data from the farmer's account):\n${contextBlock}\n` : "FARM CONTEXT: none provided — ask for the missing detail if it matters.\n"}

Structure every answer like this:
1. A short direct answer (1–2 sentences).
2. "What to check / what to do" as 3–5 short bullet points.
3. One line naming anything uncertain or that needs a field visit.
Do not use markdown headings, do not use tables, keep it under 220 words.`;
}

export function visionSystemPrompt(language: Language): string {
  return `You are X-FARM AI analysing a single photograph of a crop, leaf, stem or fruit
submitted by an Indian farmer.

Answer in ${LANGUAGE_NAMES[language]}.

${SAFETY_RULES}

Image-analysis rules:
- Describe only what is visible in the photograph. If the image is blurry, dark,
  too far away, or not a plant, say that instead of guessing.
- Give a differential, not a verdict: the most likely visible condition first.
- State your confidence honestly (low / medium / high) and list what would raise
  confidence (closer leaf photo, underside of leaf, whole-plant photo, lab test).
- Never claim a laboratory diagnosis. This is a screening aid.
- If the symptoms suggest something that spreads fast or affects food safety,
  say that quick advice from an agriculture officer is important.`;
}

export const VISION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    isPlantImage: { type: "boolean" },
    possibleProblem: { type: "string" },
    visibleSymptoms: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    severity: { type: "string", enum: ["low", "moderate", "high", "unknown"] },
    nextSteps: { type: "array", items: { type: "string" } },
    prevention: { type: "array", items: { type: "string" } },
    uncertaintyNote: { type: "string" },
  },
  required: [
    "isPlantImage",
    "possibleProblem",
    "visibleSymptoms",
    "confidence",
    "severity",
    "nextSteps",
    "prevention",
    "uncertaintyNote",
  ],
} as const;

export function recommendationSystemPrompt(language: Language): string {
  return `You are X-FARM AI advising an Indian farmer on which crops to plant.

Answer in ${LANGUAGE_NAMES[language]}.

${SAFETY_RULES}

Recommendation rules:
- Recommend 3 to 4 crops ranked from most suitable to least suitable for the
  supplied conditions.
- Reason from the supplied soil type, pH, water availability, season, area and
  previous crop. Say explicitly when a recommendation depends on an assumption.
- Never guarantee yield or income. Describe risks (water need, pest pressure,
  market timing, duration) instead.
- Prefer crops that are actually grown in the stated district or state.
- Rotate: if the previous crop was a cereal, consider a pulse or oilseed.`;
}

export const RECOMMENDATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cropName: { type: "string" },
          suitability: { type: "string", enum: ["best", "good", "possible"] },
          reasoning: { type: "string" },
          considerations: { type: "array", items: { type: "string" } },
          growingInfo: {
            type: "object",
            properties: {
              season: { type: "string" },
              durationDays: { type: "string" },
              waterNeed: { type: "string" },
              sowingWindow: { type: "string" },
              spacingOrSeedRate: { type: "string" },
            },
            required: ["season", "durationDays", "waterNeed", "sowingWindow"],
          },
        },
        required: ["cropName", "suitability", "reasoning", "considerations", "growingInfo"],
      },
    },
    generalAdvice: { type: "string" },
    uncertainties: { type: "array", items: { type: "string" } },
  },
  required: ["recommendations", "generalAdvice", "uncertainties"],
} as const;

/** Compact, human-readable context block built from real database rows. */
export function buildFarmContext(input: {
  profile?: { full_name?: string | null; district?: string | null; state?: string | null } | null;
  farm?: {
    name?: string | null;
    size_acres?: number | string | null;
    soil_type?: string | null;
    irrigation_source?: string | null;
    village?: string | null;
    district?: string | null;
  } | null;
  crops?: Array<{ crop_name: string; season?: string | null; status?: string | null; sowing_date?: string | null }>;
  soil?: {
    soil_type?: string | null;
    ph?: number | string | null;
    nitrogen?: number | string | null;
    phosphorus?: number | string | null;
    potassium?: number | string | null;
    organic_matter_pct?: number | string | null;
    source?: string | null;
    measured_at?: string | null;
  } | null;
  weather?: {
    temperature_c?: number | string | null;
    humidity_pct?: number | string | null;
    wind_kph?: number | string | null;
    rain_probability_pct?: number | string | null;
    observed_at?: string | null;
  } | null;
  language?: string;
}): string {
  const lines: string[] = [];
  const { profile, farm, crops, soil, weather } = input;

  if (profile) {
    lines.push(
      `Farmer: ${profile.full_name ?? "unknown name"}${profile.district ? `, ${profile.district} district` : ""}${
        profile.state ? `, ${profile.state}` : ""
      }`,
    );
  }
  if (farm) {
    lines.push(
      `Farm: ${farm.name ?? "unnamed"}${farm.size_acres ? `, ${farm.size_acres} acres` : ""}${
        farm.village ? `, village ${farm.village}` : ""
      }${farm.district ? `, ${farm.district}` : ""}`,
    );
    if (farm.soil_type) lines.push(`Soil type (farmer entered): ${farm.soil_type}`);
    if (farm.irrigation_source) lines.push(`Water source: ${farm.irrigation_source}`);
  }
  if (crops?.length) {
    lines.push(
      `Current/recent crops: ${crops
        .map((crop) => `${crop.crop_name}${crop.season ? ` (${crop.season})` : ""}${crop.status ? ` — ${crop.status}` : ""}`)
        .join("; ")}`,
    );
  }
  if (soil) {
    const values = [
      soil.soil_type ? `type ${soil.soil_type}` : null,
      soil.ph ? `pH ${soil.ph}` : null,
      soil.nitrogen ? `N ${soil.nitrogen}` : null,
      soil.phosphorus ? `P ${soil.phosphorus}` : null,
      soil.potassium ? `K ${soil.potassium}` : null,
      soil.organic_matter_pct ? `organic matter ${soil.organic_matter_pct}%` : null,
    ].filter(Boolean);
    if (values.length) {
      lines.push(
        `Soil test (${soil.source ?? "manual"}${soil.measured_at ? `, ${soil.measured_at}` : ""}): ${values.join(", ")}`,
      );
    }
  }
  if (weather) {
    const values = [
      weather.temperature_c !== undefined && weather.temperature_c !== null ? `${weather.temperature_c}°C` : null,
      weather.humidity_pct !== undefined && weather.humidity_pct !== null ? `humidity ${weather.humidity_pct}%` : null,
      weather.wind_kph !== undefined && weather.wind_kph !== null ? `wind ${weather.wind_kph} km/h` : null,
      weather.rain_probability_pct !== undefined && weather.rain_probability_pct !== null
        ? `rain chance ${weather.rain_probability_pct}%`
        : null,
    ].filter(Boolean);
    if (values.length) {
      lines.push(
        `Weather now${weather.observed_at ? ` (${weather.observed_at})` : ""}: ${values.join(", ")} — source: Open-Meteo`,
      );
    }
  }

  return lines.join("\n");
}
