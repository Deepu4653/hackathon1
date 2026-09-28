import { getDataClient } from "@/lib/db";
import type {
  Category,
  Favorite,
  Listing,
  ListingImage,
  ListingKind,
  ListingStatus,
  Machinery,
  PublicProfile,
} from "@/lib/db/types";

export interface ListingFilters {
  q?: string;
  kind?: ListingKind | "all";
  categoryId?: string;
  district?: string;
  state?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "nearest";
  page?: number;
  pageSize?: number;
  sellerId?: string;
  statuses?: ListingStatus[];
  featuredOnly?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface ListingSearchResult {
  rows: Array<Listing & { primary_image?: string | null; category?: Category | null; machine_type?: string | null }>;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const MAX_PAGE_SIZE = 48;

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function searchListings(filters: ListingFilters = {}): Promise<ListingSearchResult> {
  const db = await getDataClient();
  const requestedPage = Number.isFinite(filters.page) ? Math.max(1, Math.trunc(filters.page as number)) : 1;
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? 12), MAX_PAGE_SIZE);
  const statuses = filters.statuses ?? ["active"];

  const build = () => {
    let query = db.from<Listing>("listings").select("*", { count: "exact" }).in("status", statuses);

    if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind);
    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters.district) query = query.eq("district", filters.district);
    if (filters.state) query = query.eq("state", filters.state);
    if (filters.sellerId) query = query.eq("seller_id", filters.sellerId);
    if (filters.featuredOnly) query = query.eq("is_featured", true);
    if (typeof filters.minPrice === "number" && Number.isFinite(filters.minPrice)) {
      query = query.gte("price_per_unit", filters.minPrice);
    }
    if (typeof filters.maxPrice === "number" && Number.isFinite(filters.maxPrice)) {
      query = query.lte("price_per_unit", filters.maxPrice);
    }
    if (filters.q && filters.q.trim().length >= 2) {
      query = query.textSearch("search_document", filters.q.trim(), { type: "websearch", config: "simple" });
    }

    switch (filters.sort) {
      case "price_asc":
        return query.order("price_per_unit", { ascending: true }).order("created_at", { ascending: false });
      case "price_desc":
        return query.order("price_per_unit", { ascending: false }).order("created_at", { ascending: false });
      default:
        return query.order("created_at", { ascending: false });
    }
  };

  const run = async (pageNumber: number) => {
    const { data, error, count } = await build().range((pageNumber - 1) * pageSize, pageNumber * pageSize - 1);
    return { rows: (data ?? []) as Listing[], total: count ?? null, error };
  };

  const first = await run(requestedPage);
  if (first.error) {
    console.error("[listings] search failed:", first.error.message);
    return { rows: [], total: 0, page: requestedPage, pageSize, hasMore: false };
  }

  let page = requestedPage;
  let rows = first.rows;
  let total = first.total ?? rows.length;

  // A stale or hand-edited `?page=` must never render an empty marketplace that
  // claims to be page 9999 of 2 — fall back to the real last page.
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (page > lastPage) {
    page = lastPage;
    const clamped = await run(page);
    rows = clamped.rows;
    if (clamped.total !== null) total = clamped.total;
  }

  if (filters.sort === "nearest" && typeof filters.latitude === "number" && typeof filters.longitude === "number") {
    const origin: [number, number] = [filters.latitude, filters.longitude];
    rows = [...rows].sort((a, b) => {
      const distanceA = a.latitude !== null && a.longitude !== null ? haversineKm(origin, [a.latitude, a.longitude]) : Number.MAX_SAFE_INTEGER;
      const distanceB = b.latitude !== null && b.longitude !== null ? haversineKm(origin, [b.latitude, b.longitude]) : Number.MAX_SAFE_INTEGER;
      return distanceA - distanceB;
    });
  }

  const ids = rows.map((row) => row.id);
  const [images, categories, machinery] = await Promise.all([
    ids.length ? listImagesForListings(ids) : Promise.resolve([]),
    categoryMap(),
    ids.length ? machineryForListings(ids) : Promise.resolve(new Map<string, Machinery>()),
  ]);

  const enriched = rows.map((row) => ({
    ...row,
    primary_image: images.find((image) => image.listing_id === row.id)?.url ?? null,
    category: row.category_id ? categories.get(row.category_id) ?? null : null,
    machine_type: machinery.get(row.id)?.machine_type ?? null,
  }));

  return { rows: enriched, total, page, pageSize, hasMore: page * pageSize < total };
}

async function categoryMap(): Promise<Map<string, Category>> {
  const db = await getDataClient();
  const { data } = await db.from<Category>("categories").select("*").limit(100);
  return new Map(((data ?? []) as Category[]).map((category) => [category.id, category]));
}

export async function listImagesForListings(listingIds: string[]): Promise<ListingImage[]> {
  if (listingIds.length === 0) return [];
  const db = await getDataClient();
  const { data } = await db
    .from<ListingImage>("listing_images")
    .select("*")
    .in("listing_id", listingIds)
    .order("sort_order", { ascending: true })
    .limit(200);
  return (data ?? []) as ListingImage[];
}

async function machineryForListings(listingIds: string[]): Promise<Map<string, Machinery>> {
  if (listingIds.length === 0) return new Map();
  const db = await getDataClient();
  const { data } = await db
    .from<Machinery>("machinery")
    .select("*")
    .in("listing_id", listingIds)
    .limit(100);
  return new Map(((data ?? []) as Machinery[]).map((row) => [row.listing_id, row]));
}

export interface ListingDetail extends Listing {
  images: ListingImage[];
  category: Category | null;
  machinery: Machinery | null;
  seller: PublicProfile | null;
  isFavorite: boolean;
}

export async function getListingDetail(
  listingId: string,
  viewerId: string | null,
): Promise<ListingDetail | null> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<Listing>("listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (error || !data) return null;

  const listing = data as Listing;

  const [imagesResult, sellerResult, machineryResult, favoriteResult] = await Promise.all([
    db.from<ListingImage>("listing_images").select("*").eq("listing_id", listingId).order("sort_order", { ascending: true }).limit(20),
    db.from<PublicProfile>("public_profiles").select("*").eq("id", listing.seller_id).maybeSingle(),
    db.from<Machinery>("machinery").select("*").eq("listing_id", listingId).maybeSingle(),
    viewerId
      ? db.from<Favorite>("favorites").select("id").eq("user_id", viewerId).eq("listing_id", listingId).maybeSingle()
      : Promise.resolve({ data: null, error: null, count: null }),
  ]);

  let category: Category | null = null;
  if (listing.category_id) {
    const { data: categoryRow } = await db
      .from<Category>("categories")
      .select("*")
      .eq("id", listing.category_id)
      .maybeSingle();
    category = (categoryRow as Category) ?? null;
  }

  return {
    ...listing,
    images: (imagesResult.data ?? []) as ListingImage[],
    seller: (sellerResult.data as PublicProfile) ?? null,
    machinery: (machineryResult.data as Machinery) ?? null,
    category,
    isFavorite: Boolean(favoriteResult.data),
  };
}

export interface ListingInput {
  kind: ListingKind;
  category_id?: string | null;
  title: string;
  description?: string | null;
  crop_name?: string | null;
  quantity?: number | null;
  unit?: string | null;
  price_per_unit?: number | null;
  is_negotiable?: boolean;
  min_order_quantity?: number | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  harvest_date?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  status?: ListingStatus;
  contact_phone?: string | null;
}

export async function createListing(
  sellerId: string,
  input: ListingInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<Listing>("listings")
    .insert({ ...input, seller_id: sellerId, status: input.status ?? "active" })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string } | null)?.id };
}

export async function updateListing(
  sellerId: string,
  listingId: string,
  input: Partial<ListingInput>,
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db
    .from("listings")
    .update(input)
    .eq("id", listingId)
    .eq("seller_id", sellerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteListing(sellerId: string, listingId: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db.from("listings").delete().eq("id", listingId).eq("seller_id", sellerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listMyListings(userId: string): Promise<Listing[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<Listing>("listings")
    .select("*")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []) as Listing[];
}

export async function getMyListing(userId: string, listingId: string): Promise<Listing | null> {
  const db = await getDataClient();
  const { data } = await db
    .from<Listing>("listings")
    .select("*")
    .eq("id", listingId)
    .eq("seller_id", userId)
    .maybeSingle();
  return (data as Listing) ?? null;
}

export async function addListingImages(
  listingId: string,
  images: Array<{ url: string; storage_path?: string | null; mime_type?: string | null; file_size?: number | null; sort_order?: number }>,
): Promise<{ ok: boolean; error?: string }> {
  if (images.length === 0) return { ok: true };
  const db = await getDataClient();
  const { error } = await db.from("listing_images").insert(
    images.map((image, index) => ({
      listing_id: listingId,
      url: image.url,
      storage_path: image.storage_path ?? null,
      mime_type: image.mime_type ?? null,
      file_size: image.file_size ?? null,
      sort_order: image.sort_order ?? index,
    })),
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteListingImage(
  listingId: string,
  imageId: string,
  sellerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const listing = await getMyListing(sellerId, listingId);
  if (!listing) return { ok: false, error: "Listing not found." };
  const db = await getDataClient();
  const { error } = await db.from("listing_images").delete().eq("id", imageId).eq("listing_id", listingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function incrementListingViews(listingId: string): Promise<void> {
  try {
    const db = await getDataClient();
    await db.rpc("bump_listing_views", { p_listing_id: listingId });
  } catch {
    // View counters must never break a page render.
  }
}

// ---------------------------------------------------------------------------
// Machinery
// ---------------------------------------------------------------------------

export interface MachineryInput {
  machine_type: Machinery["machine_type"];
  brand?: string | null;
  model?: string | null;
  manufacture_year?: number | null;
  horsepower?: number | null;
  rental_price_per_day?: number | null;
  rental_price_per_hour?: number | null;
  rental_price_per_acre?: number | null;
  with_operator?: boolean;
  service_radius_km?: number | null;
  availability_start?: string | null;
  availability_end?: string | null;
  status?: Machinery["status"];
  description?: string | null;
}

export async function createMachinery(
  ownerId: string,
  listingId: string,
  input: MachineryInput,
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db
    .from("machinery")
    .insert({ ...input, owner_id: ownerId, listing_id: listingId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateMachinery(
  ownerId: string,
  listingId: string,
  input: Partial<MachineryInput>,
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db
    .from("machinery")
    .update(input)
    .eq("listing_id", listingId)
    .eq("owner_id", ownerId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Machinery pins for the map (owner + type + location). */
export async function listMachineryPins(): Promise<
  Array<Pick<Listing, "id" | "title" | "latitude" | "longitude" | "district" | "price_per_unit"> & { machine_type: Machinery["machine_type"] | null }>
> {
  const db = await getDataClient();
  const { data } = await db
    .from<Listing>("listings")
    .select("id,title,latitude,longitude,district,price_per_unit")
    .eq("kind", "machinery")
    .eq("status", "active")
    .limit(100);
  const listings = (data ?? []) as Listing[];
  const machinery = await machineryForListings(listings.map((listing) => listing.id));
  return listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    latitude: listing.latitude,
    longitude: listing.longitude,
    district: listing.district,
    price_per_unit: listing.price_per_unit,
    machine_type: machinery.get(listing.id)?.machine_type ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------

export async function toggleFavorite(
  userId: string,
  listingId: string,
): Promise<{ ok: boolean; favorited?: boolean; error?: string }> {
  const db = await getDataClient();
  const { data: existing } = await db
    .from<Favorite>("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (existing) {
    const { error } = await db.from("favorites").delete().eq("id", (existing as Favorite).id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, favorited: false };
  }

  const { error } = await db.from("favorites").insert({ user_id: userId, listing_id: listingId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, favorited: true };
}

export async function listFavorites(userId: string): Promise<Array<Listing & { saved_at: string; primary_image?: string | null }>> {
  const db = await getDataClient();
  const { data } = await db
    .from<Favorite>("favorites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  const favorites = (data ?? []) as Favorite[];
  if (favorites.length === 0) return [];

  const listingIds = favorites.map((favorite) => favorite.listing_id);
  const { data: listings } = await db.from<Listing>("listings").select("*").in("id", listingIds).limit(100);
  const images = await listImagesForListings(listingIds);
  const byId = new Map(((listings ?? []) as Listing[]).map((listing) => [listing.id, listing]));

  return favorites
    .map((favorite) => {
      const listing = byId.get(favorite.listing_id);
      if (!listing) return null;
      return {
        ...listing,
        saved_at: favorite.created_at,
        primary_image: images.find((image) => image.listing_id === listing.id)?.url ?? null,
      };
    })
    .filter((row): row is Listing & { saved_at: string; primary_image: string | null } => row !== null);
}

export async function getFavoriteIds(userId: string): Promise<string[]> {
  const db = await getDataClient();
  const { data } = await db.from<Favorite>("favorites").select("listing_id").eq("user_id", userId).limit(200);
  return ((data ?? []) as Favorite[]).map((favorite) => favorite.listing_id);
}

/** Map pins for the marketplace map view. */
export async function listListingPins(kind?: ListingKind) {
  const db = await getDataClient();
  const query = db
    .from<Listing>("listings")
    .select("id,title,latitude,longitude,district,village,kind,price_per_unit,unit")
    .eq("status", "active");
  const scoped = kind ? query.eq("kind", kind) : query;
  const { data } = await scoped.limit(200);
  return ((data ?? []) as Listing[]).filter((row) => row.latitude !== null && row.longitude !== null);
}
