import { getServiceDataClient, logAuditEvent } from "@/lib/db";
import type {
  AuditLog,
  Category,
  CropAnalysis,
  Listing,
  Message,
  Profile,
  Report,
  UserRole,
} from "@/lib/db/types";

export interface PlatformStats {
  totalUsers: number;
  farmers: number;
  sellers: number;
  activeListings: number;
  totalListings: number;
  messages: number;
  cropAnalyses: number;
  openReports: number;
  categories: number;
  aiCallsLast7Days: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const service = await getServiceDataClient();

  const count = async (
    table: string,
    configure?: (builder: unknown) => unknown,
  ): Promise<number> => {
    const builder = service.from(table).select("id", { count: "exact", head: true });
    const configured = configure ? (configure(builder) as typeof builder) : builder;
    const { count: value } = await configured;
    return value ?? 0;
  };

  const [
    totalUsers,
    farmers,
    sellers,
    activeListings,
    totalListings,
    messages,
    cropAnalyses,
    openReports,
    categories,
    aiCallsLast7Days,
  ] = await Promise.all([
    count("profiles"),
    count("profiles", (builder) => (builder as ReturnType<typeof service.from>).eq("role", "farmer")),
    count("profiles", (builder) =>
      (builder as ReturnType<typeof service.from>).in("role", ["seller", "distributor", "machine_owner"]),
    ),
    count("listings", (builder) => (builder as ReturnType<typeof service.from>).eq("status", "active")),
    count("listings"),
    count("messages"),
    count("crop_analyses"),
    count("reports", (builder) => (builder as ReturnType<typeof service.from>).eq("status", "open")),
    count("categories"),
    count("usage_events", (builder) =>
      (builder as ReturnType<typeof service.from>).gte(
        "created_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      ),
    ),
  ]);

  return {
    totalUsers,
    farmers,
    sellers,
    activeListings,
    totalListings,
    messages,
    cropAnalyses,
    openReports,
    categories,
    aiCallsLast7Days,
  };
}

export interface AdminUserRow extends Profile {
  listing_count: number;
}

export async function listUsersForAdmin(search?: string): Promise<Profile[]> {
  const service = await getServiceDataClient();
  let query = service.from<Profile>("profiles").select("*");
  const term = search?.trim();
  if (term) {
    query = query.ilike("full_name", `%${term}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) {
    console.error("[admin] list users failed:", error.message);
    return [];
  }
  return (data ?? []) as Profile[];
}

export async function listAllListings(status?: Listing["status"]): Promise<Listing[]> {
  const service = await getServiceDataClient();
  const query = service.from<Listing>("listings").select("*");
  const scoped = status ? query.eq("status", status) : query;
  const { data, error } = await scoped.order("created_at", { ascending: false }).limit(100);
  if (error) return [];
  return (data ?? []) as Listing[];
}

export async function listReports(status?: Report["status"]): Promise<Report[]> {
  const service = await getServiceDataClient();
  const query = service.from<Report>("reports").select("*");
  const scoped = status ? query.eq("status", status) : query;
  const { data, error } = await scoped.order("created_at", { ascending: false }).limit(100);
  if (error) return [];
  return (data ?? []) as Report[];
}

export async function listAuditLogs(limit = 20): Promise<AuditLog[]> {
  const service = await getServiceDataClient();
  const { data } = await service
    .from<AuditLog>("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditLog[];
}

export async function listRecentAnalyses(limit = 10): Promise<CropAnalysis[]> {
  const service = await getServiceDataClient();
  const { data } = await service
    .from<CropAnalysis>("crop_analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as CropAnalysis[];
}

export async function listRecentMessages(limit = 10): Promise<Message[]> {
  const service = await getServiceDataClient();
  const { data } = await service
    .from<Message>("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Message[];
}

// ---------------------------------------------------------------------------
// Privileged mutations (service role + audit trail)
// ---------------------------------------------------------------------------

export async function setUserRole(
  actorId: string,
  userId: string,
  role: UserRole,
): Promise<{ ok: boolean; error?: string }> {
  const service = await getServiceDataClient();
  const { error } = await service.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  await logAuditEvent({ action: "admin.set_user_role", entity: "profiles", entityId: userId, actorId, meta: { role } });
  return { ok: true };
}

export async function setUserBlocked(
  actorId: string,
  userId: string,
  isBlocked: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const service = await getServiceDataClient();
  const { error } = await service.from("profiles").update({ is_blocked: isBlocked }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  await logAuditEvent({
    action: isBlocked ? "admin.block_user" : "admin.unblock_user",
    entity: "profiles",
    entityId: userId,
    actorId,
  });
  return { ok: true };
}

export async function setListingStatus(
  actorId: string,
  listingId: string,
  status: Listing["status"],
): Promise<{ ok: boolean; error?: string }> {
  const service = await getServiceDataClient();
  const { error } = await service.from("listings").update({ status }).eq("id", listingId);
  if (error) return { ok: false, error: error.message };
  await logAuditEvent({ action: "admin.set_listing_status", entity: "listings", entityId: listingId, actorId, meta: { status } });
  return { ok: true };
}

export async function setListingFeatured(
  actorId: string,
  listingId: string,
  featured: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const service = await getServiceDataClient();
  const { error } = await service.from("listings").update({ is_featured: featured }).eq("id", listingId);
  if (error) return { ok: false, error: error.message };
  await logAuditEvent({
    action: featured ? "admin.feature_listing" : "admin.unfeature_listing",
    entity: "listings",
    entityId: listingId,
    actorId,
  });
  return { ok: true };
}

export async function updateReport(
  actorId: string,
  reportId: string,
  status: Report["status"],
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const service = await getServiceDataClient();
  const { error } = await service
    .from("reports")
    .update({ status, resolution_note: note ?? null, resolved_by: actorId })
    .eq("id", reportId);
  if (error) return { ok: false, error: error.message };
  await logAuditEvent({ action: "admin.update_report", entity: "reports", entityId: reportId, actorId, meta: { status } });
  return { ok: true };
}

export async function saveCategory(
  actorId: string,
  input: {
    id?: string;
    slug: string;
    name_en: string;
    name_te?: string | null;
    name_hi?: string | null;
    kind: Category["kind"];
    icon?: string | null;
    sort_order?: number;
    is_active?: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  const service = await getServiceDataClient();
  if (input.id) {
    const { error } = await service
      .from("categories")
      .update({
        name_en: input.name_en,
        name_te: input.name_te ?? null,
        name_hi: input.name_hi ?? null,
        kind: input.kind,
        icon: input.icon ?? null,
        sort_order: input.sort_order ?? 100,
        is_active: input.is_active ?? true,
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    await logAuditEvent({ action: "admin.update_category", entity: "categories", entityId: input.id, actorId });
    return { ok: true };
  }

  const { data, error } = await service
    .from<Category>("categories")
    .insert({
      slug: input.slug,
      name_en: input.name_en,
      name_te: input.name_te ?? null,
      name_hi: input.name_hi ?? null,
      kind: input.kind,
      icon: input.icon ?? null,
      sort_order: input.sort_order ?? 100,
      is_active: input.is_active ?? true,
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  await logAuditEvent({
    action: "admin.create_category",
    entity: "categories",
    entityId: (data as { id: string } | null)?.id ?? null,
    actorId,
  });
  return { ok: true };
}

export async function setCategoryActive(
  actorId: string,
  categoryId: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const service = await getServiceDataClient();
  const { error } = await service.from("categories").update({ is_active: isActive }).eq("id", categoryId);
  if (error) return { ok: false, error: error.message };
  await logAuditEvent({
    action: isActive ? "admin.activate_category" : "admin.deactivate_category",
    entity: "categories",
    entityId: categoryId,
    actorId,
  });
  return { ok: true };
}

