import { getDataClient } from "@/lib/db";
import type { Category, CategoryKind } from "@/lib/db/types";

const MAX_ROWS = 100;

export async function listCategories(kind?: CategoryKind): Promise<Category[]> {
  const db = await getDataClient();
  const query = db.from<Category>("categories").select("*");
  const scoped = kind ? query.eq("kind", kind) : query;
  const { data, error } = await scoped
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(MAX_ROWS);
  if (error) {
    console.error("[categories] list failed:", error.message);
    return [];
  }
  return (data ?? []) as Category[];
}

/** Admin view: includes deactivated categories. */
export async function listAllCategories(): Promise<Category[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<Category>("categories")
    .select("*")
    .order("kind", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(MAX_ROWS);
  if (error) return [];
  return (data ?? []) as Category[];
}
