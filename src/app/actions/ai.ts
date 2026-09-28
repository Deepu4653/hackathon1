"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDataClient } from "@/lib/db";
import type { AiMessage, CropAnalysis, Farm, Language, Profile, SoilRecord } from "@/lib/db/types";
import { askAssistant, buildFarmContext, isGeminiConfigured, analyseCropImage, recommendCrops } from "@/lib/gemini";
import {
  appendAiMessage,
  checkAndRecordUsage,
  createAiConversation,
  deleteAiConversation,
  listAiMessages,
  saveCropAnalysis,
} from "@/lib/repos/ai";
import { getPrimaryFarm } from "@/lib/repos/farms";
import { getActiveCropRecords } from "@/lib/repos/crops";
import { getLatestSoilRecord } from "@/lib/repos/soil";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { uploadObject, validateImageFile, buildStoragePath } from "@/lib/storage";
import { actionError, actionOk, fieldErrorsFrom, formValue, type ActionState } from "@/lib/actions/state";
import { assistantQuestionSchema, cropAnalysisFormSchema, recommendationSchema } from "@/lib/validation/schemas";

/** Builds the real-data context block passed to Gemini (never fabricated). */
async function buildContext(userId: string, farmIdOverride?: string, language: Language = "en") {
  let farm: Farm | null = null;
  if (farmIdOverride) {
    const db = await getDataClient();
    const { data } = await db
      .from<Farm>("farms")
      .select("*")
      .eq("id", farmIdOverride)
      .eq("user_id", userId)
      .maybeSingle();
    farm = (data as Farm) ?? null;
  } else {
    farm = await getPrimaryFarm(userId);
  }

  const [crops, soil, profile] = await Promise.all([
    getActiveCropRecords(userId),
    getLatestSoilRecord(userId),
    (await getDataClient()).from<Profile>("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);

  let weather: Awaited<ReturnType<typeof fetchWeather>> | null = null;
  if (farm?.latitude != null && farm?.longitude != null) {
    weather = await fetchWeather(farm.latitude, farm.longitude);
  }

  const contextBlock = buildFarmContext({
    profile: (profile.data as Profile) ?? undefined,
    farm,
    crops: crops.map((crop) => ({
      crop_name: crop.crop_name,
      season: crop.season,
      status: crop.status,
      sowing_date: crop.sowing_date,
    })),
    soil: soil ?? undefined,
    weather: weather?.ok
      ? {
          temperature_c: weather.snapshot.current.temperatureC,
          humidity_pct: weather.snapshot.current.humidityPct,
          wind_kph: weather.snapshot.current.windKph,
          rain_probability_pct: weather.snapshot.current.rainProbabilityPct,
          observed_at: weather.snapshot.observedAt,
        }
      : null,
    language,
  });

  return { farm, contextBlock, soil: soil as SoilRecord | null };
}

export async function askAssistantAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/assistant");
  const parsed = assistantQuestionSchema.safeParse({
    question: formValue(formData, "question"),
    conversationId: formValue(formData, "conversationId") || undefined,
    language: formValue(formData, "language") || user.profile.preferred_language,
    farmId: formValue(formData, "farmId") || undefined,
  });

  if (!parsed.success) {
    return actionError("Please write your question.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  if (!isGeminiConfigured()) {
    return actionError("not_configured", { code: "not_configured" });
  }

  const usage = await checkAndRecordUsage(user.id, "ai_chat");
  if (!usage.allowed) {
    return actionError("rate_limited", { code: "rate_limited" });
  }

  const { contextBlock } = await buildContext(user.id, parsed.data.farmId, parsed.data.language);

  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const { data } = await (await getDataClient())
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) conversationId = null;
  }

  if (!conversationId) {
    const conversation = await createAiConversation(
      user.id,
      parsed.data.language,
      parsed.data.question,
      parsed.data.farmId ?? null,
    );
    conversationId = conversation?.id ?? null;
  }

  if (!conversationId) {
    return actionError("We could not start that conversation. Please try again.");
  }

  const history = (await listAiMessages(conversationId, 8)) as AiMessage[];

  await appendAiMessage({ conversationId, role: "user", content: parsed.data.question });

  const started = Date.now();
  const answer = await askAssistant({
    question: parsed.data.question,
    language: parsed.data.language,
    contextBlock,
    history: history
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role === "user" ? "user" : "assistant", content: message.content })),
  });

  if (!answer.ok) {
    const message =
      answer.reason === "not_configured"
        ? "AI analysis could not be completed because the AI service is not configured."
        : "AI analysis could not be completed. Please try again.";
    return actionError(message, { code: answer.reason === "rate_limited" ? "rate_limited" : undefined, conversationId });
  }

  await appendAiMessage({
    conversationId,
    role: "assistant",
    content: answer.answer,
    model: answer.model,
    latencyMs: Date.now() - started,
  });

  revalidatePath("/assistant");
  revalidatePath(`/assistant/${conversationId}`);
  return actionOk("Answer ready.", { conversationId, answer: answer.answer });
}

export async function deleteAiConversationAction(formData: FormData): Promise<void> {
  const user = await requireUser("/assistant");
  const conversationId = formValue(formData, "conversationId");
  if (conversationId) await deleteAiConversation(user.id, conversationId);
  revalidatePath("/assistant");
}

/**
 * Crop photo analysis: validate → store privately → Gemini vision → persist.
 * Every outcome (including failures) is recorded so the farmer can see history.
 */
export async function analyseCropImageAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/crop-doctor");

  const meta = cropAnalysisFormSchema.safeParse({
    cropName: formValue(formData, "cropName"),
    farmId: formValue(formData, "farmId") || undefined,
    notes: formValue(formData, "notes"),
  });
  if (!meta.success) {
    return actionError("Please check the highlighted fields.", { fieldErrors: fieldErrorsFrom(meta.error.issues) });
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return actionError("Please choose a photo of the affected leaf or plant.");
  }

  const validation = await validateImageFile(file, "crop-images");
  if (!validation.ok) {
    return actionError(validation.error, { code: "invalid" });
  }

  if (!isGeminiConfigured()) {
    return actionError("not_configured", { code: "not_configured" });
  }

  const usage = await checkAndRecordUsage(user.id, "ai_vision");
  if (!usage.allowed) {
    return actionError("rate_limited", { code: "rate_limited" });
  }

  // Photos are stored in the private `crop-images` bucket under <user-id>/…
  const objectPath = buildStoragePath(user.id, file.name || "crop", validation.extension);
  const stored = await uploadObject({
    bucket: "crop-images",
    objectPath,
    bytes: validation.bytes,
    mimeType: validation.mimeType,
    fileName: file.name,
  });

  if ("error" in stored) {
    return actionError(stored.error);
  }

  const { contextBlock } = await buildContext(user.id, meta.data.farmId, user.profile.preferred_language);

  const imageBase64 = Buffer.from(validation.bytes).toString("base64");
  const outcome = await analyseCropImage({
    imageBase64,
    mimeType: validation.mimeType,
    cropName: meta.data.cropName ?? null,
    language: user.profile.preferred_language,
    notes: meta.data.notes ?? null,
    contextBlock,
  });

  if (!outcome.ok) {
    const record = await saveCropAnalysis(user.id, {
      farm_id: meta.data.farmId ?? null,
      crop_name: meta.data.cropName ?? null,
      image_url: stored.url,
      storage_path: stored.path,
      status: "failed",
      error_message: outcome.reason,
    });

    const message =
      outcome.reason === "not_configured"
        ? "Photo analysis is not configured on this deployment."
        : outcome.reason === "rate_limited"
          ? "AI analysis could not be completed right now (usage limit). Please try again later."
          : outcome.message;

    return actionError(message, {
      code: outcome.reason === "rate_limited" ? "rate_limited" : outcome.reason === "not_configured" ? "not_configured" : undefined,
      analysisId: record?.id,
      reason: outcome.reason,
    });
  }

  const record = await saveCropAnalysis(user.id, {
    farm_id: meta.data.farmId ?? null,
    crop_name: meta.data.cropName ?? null,
    image_url: stored.url,
    storage_path: stored.path,
    status: "completed",
    possible_problem: outcome.result.possibleProblem,
    severity: outcome.result.severity,
    confidence: outcome.result.confidence,
    visible_symptoms: outcome.result.visibleSymptoms,
    next_steps: outcome.result.nextSteps,
    prevention: outcome.result.prevention,
    uncertainty_note: outcome.result.uncertaintyNote,
    model: outcome.model,
    raw: outcome.result as unknown as Record<string, unknown>,
  });

  if (!record) {
    return actionOk("Analysis complete.", { result: outcome.result, analysisId: null });
  }

  revalidatePath("/crop-doctor");
  return actionOk("Analysis complete.", { analysisId: record.id, result: outcome.result });
}

export async function deleteCropAnalysisAction(formData: FormData): Promise<void> {
  const user = await requireUser("/crop-doctor");
  const analysisId = formValue(formData, "analysisId");
  if (!analysisId) return;
  const db = await getDataClient();
  const { data } = await db
    .from<CropAnalysis>("crop_analyses")
    .select("storage_path")
    .eq("id", analysisId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (data?.storage_path) {
    const { removeObject } = await import("@/lib/storage");
    await removeObject("crop-images", data.storage_path);
  }
  await db.from("crop_analyses").delete().eq("id", analysisId).eq("user_id", user.id);
  revalidatePath("/crop-doctor");
}

export async function recommendCropsAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("/recommendation");

  const parsed = recommendationSchema.safeParse({
    location: formValue(formData, "location"),
    season: formValue(formData, "season") || "kharif",
    soil_type: formValue(formData, "soil_type"),
    ph: formValue(formData, "ph") === "" ? undefined : Number(formValue(formData, "ph")),
    water_availability: formValue(formData, "water_availability") || "medium",
    farm_size_acres:
      formValue(formData, "farm_size_acres") === "" ? undefined : Number(formValue(formData, "farm_size_acres")),
    previous_crop: formValue(formData, "previous_crop"),
    preference: formValue(formData, "preference") || "any",
    language: formValue(formData, "language") || user.profile.preferred_language,
    notes: formValue(formData, "notes"),
  });

  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", { fieldErrors: fieldErrorsFrom(parsed.error.issues) });
  }

  if (!isGeminiConfigured()) {
    return actionError("not_configured", { code: "not_configured" });
  }

  const usage = await checkAndRecordUsage(user.id, "ai_recommendation");
  if (!usage.allowed) {
    return actionError("rate_limited", { code: "rate_limited" });
  }

  const outcome = await recommendCrops({
    location: parsed.data.location,
    season: parsed.data.season,
    soilType: parsed.data.soil_type,
    ph: parsed.data.ph,
    waterAvailability: parsed.data.water_availability,
    farmSizeAcres: parsed.data.farm_size_acres,
    previousCrop: parsed.data.previous_crop,
    preference: parsed.data.preference,
    language: parsed.data.language,
    notes: parsed.data.notes,
  });

  if (!outcome.ok) {
    return actionError(
      outcome.reason === "not_configured"
        ? "not_configured"
        : outcome.reason === "rate_limited"
          ? "rate_limited"
          : outcome.message,
      { code: outcome.reason === "not_configured" ? "not_configured" : outcome.reason === "rate_limited" ? "rate_limited" : undefined },
    );
  }

  return actionOk("Suggestions ready.", { result: outcome.result });
}
