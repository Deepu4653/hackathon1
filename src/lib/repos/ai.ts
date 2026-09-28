import { getDataClient, getServiceDataClient } from "@/lib/db";
import type { AiConversation, AiMessage, CropAnalysis, Language, UsageEvent } from "@/lib/db/types";

export async function createAiConversation(
  userId: string,
  language: Language,
  title: string,
  farmId: string | null = null,
): Promise<AiConversation | null> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<AiConversation>("ai_conversations")
    .insert({ user_id: userId, language, title: title.slice(0, 90) || "New conversation", farm_id: farmId })
    .select("*")
    .maybeSingle();
  if (error) return null;
  return (data as AiConversation) ?? null;
}

export async function listAiConversations(userId: string, limit = 20): Promise<AiConversation[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<AiConversation>("ai_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AiConversation[];
}

export async function getAiConversation(userId: string, conversationId: string): Promise<AiConversation | null> {
  const db = await getDataClient();
  const { data } = await db
    .from<AiConversation>("ai_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as AiConversation) ?? null;
}

export async function listAiMessages(conversationId: string, limit = 60): Promise<AiMessage[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<AiMessage>("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AiMessage[];
}

export async function appendAiMessage(input: {
  conversationId: string;
  role: AiMessage["role"];
  content: string;
  model?: string | null;
  latencyMs?: number | null;
}): Promise<void> {
  const db = await getDataClient();
  await db.from("ai_messages").insert({
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    model: input.model ?? null,
    latency_ms: input.latencyMs ?? null,
  });
  await db
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.conversationId);
}

export async function deleteAiConversation(userId: string, conversationId: string): Promise<void> {
  const db = await getDataClient();
  await db.from("ai_conversations").delete().eq("id", conversationId).eq("user_id", userId);
}

// ---------------------------------------------------------------------------
// Crop image analyses
// ---------------------------------------------------------------------------

export interface CropAnalysisInput {
  farm_id?: string | null;
  crop_record_id?: string | null;
  crop_name?: string | null;
  image_url: string;
  storage_path?: string | null;
  status: CropAnalysis["status"];
  possible_problem?: string | null;
  severity?: CropAnalysis["severity"];
  confidence?: CropAnalysis["confidence"];
  visible_symptoms?: unknown;
  next_steps?: unknown;
  prevention?: unknown;
  uncertainty_note?: string | null;
  model?: string | null;
  raw?: unknown;
  error_message?: string | null;
}

export async function saveCropAnalysis(
  userId: string,
  input: CropAnalysisInput,
): Promise<CropAnalysis | null> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<CropAnalysis>("crop_analyses")
    .insert({ ...input, user_id: userId })
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[analysis] save failed:", error.message);
    return null;
  }
  return (data as CropAnalysis) ?? null;
}

export async function listCropAnalyses(userId: string, limit = 20): Promise<CropAnalysis[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<CropAnalysis>("crop_analyses")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as CropAnalysis[];
}

export async function getCropAnalysis(userId: string, analysisId: string): Promise<CropAnalysis | null> {
  const db = await getDataClient();
  const { data } = await db
    .from<CropAnalysis>("crop_analyses")
    .select("*")
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as CropAnalysis) ?? null;
}

export async function deleteCropAnalysis(userId: string, analysisId: string): Promise<void> {
  const db = await getDataClient();
  await db.from("crop_analyses").delete().eq("id", analysisId).eq("user_id", userId);
}

// ---------------------------------------------------------------------------
// Usage metering (real rate limits + admin statistics)
// ---------------------------------------------------------------------------

const DAILY_LIMITS: Record<UsageEvent["kind"], number> = {
  ai_chat: 60,
  ai_vision: 25,
  ai_recommendation: 25,
  weather_fetch: 500,
  soil_lookup: 200,
};

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function checkAndRecordUsage(
  userId: string,
  kind: UsageEvent["kind"],
): Promise<RateLimitResult> {
  const limit = DAILY_LIMITS[kind];
  try {
    const db = await getDataClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from<UsageEvent>("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", kind)
      .gte("created_at", since);

    const used = count ?? 0;
    if (used >= limit) return { allowed: false, used, limit };

    await db.from("usage_events").insert({ user_id: userId, kind });
    return { allowed: true, used: used + 1, limit };
  } catch (error) {
    // Never block a real user because metering failed.
    console.warn("[usage] metering failed", error);
    return { allowed: true, used: 0, limit };
  }
}

export async function countUsageSince(kind: UsageEvent["kind"], sinceIso: string): Promise<number> {
  try {
    const service = await getServiceDataClient();
    const { count } = await service
      .from<UsageEvent>("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", kind)
      .gte("created_at", sinceIso);
    return count ?? 0;
  } catch {
    return 0;
  }
}
