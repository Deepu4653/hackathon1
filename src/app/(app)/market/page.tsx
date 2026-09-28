import Link from "next/link";
import { PlusCircle, Store } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui";
import { ListingCard } from "@/components/market/listing-card";
import { ListingFilters } from "@/components/market/listing-filters";
import { getSessionUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listCategories } from "@/lib/repos/categories";
import { getFavoriteIds, searchListings } from "@/lib/repos/listings";
import { getDataClient } from "@/lib/db";
import type { Listing, ListingKind } from "@/lib/db/types";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("market.title");

const PAGE_SIZE = 12;

/** Query strings are user input: ignore anything that is not a real number. */
function finiteParam(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pageParam(value: string | undefined): number {
  const parsed = finiteParam(value);
  return parsed === undefined ? 1 : Math.max(1, Math.trunc(parsed));
}

async function listingDistricts(): Promise<string[]> {
  const db = await getDataClient();
  const { data } = await db.from<Listing>("listings").select("district").eq("status", "active").limit(200);
  const set = new Set<string>();
  for (const row of (data ?? []) as Array<Pick<Listing, "district">>) {
    if (row.district) set.add(row.district);
  }
  return Array.from(set).sort();
}

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const { t, locale } = await getTranslatorForRequest(user?.profile.simple_mode);

  const [categories, districts] = await Promise.all([listCategories(), listingDistricts()]);

  const results = await searchListings({
    q: params.q,
    kind: (params.kind as ListingKind | "all") ?? "all",
    categoryId: params.category,
    district: params.district,
    minPrice: finiteParam(params.min),
    maxPrice: finiteParam(params.max),
    sort: (params.sort as "newest" | "price_asc" | "price_desc") ?? "newest",
    page: pageParam(params.page),
    pageSize: PAGE_SIZE,
  });

  const favorites = user ? await getFavoriteIds(user.id) : [];

  return (
    <div>
      <PageHeader
        title={t("market.title")}
        subtitle={t("market.subtitle")}
        action={
          <Link
            href="/listings/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-soil-500 px-4 text-sm font-semibold text-white hover:bg-soil-600"
          >
            <PlusCircle className="size-4" aria-hidden />
            {t("market.create")}
          </Link>
        }
      />

      <div className="mb-4">
        <ListingFilters categories={categories} districts={districts} />
      </div>

      <p className="mb-3 text-sm text-ink-500">
        {results.total} {t("market.results")}
      </p>

      {results.rows.length === 0 ? (
        <EmptyState
          icon={<Store className="size-6" aria-hidden />}
          title={t("market.noResults")}
          body={t("market.subtitle")}
          action={
            <Link
              href="/listings/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
            >
              <PlusCircle className="size-4" aria-hidden />
              {t("market.create")}
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.rows.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              t={t}
              locale={locale}
              isFavorite={favorites.includes(listing.id)}
              showFavorite={Boolean(user)}
            />
          ))}
        </ul>
      )}

      {results.total > PAGE_SIZE ? (
        <nav className="mt-6 flex items-center justify-between gap-3">
          {results.page > 1 ? (
            <Link
              href={{ pathname: "/market", query: { ...params, page: results.page - 1 } }}
              className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700"
            >
              {t("common.previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-ink-500">
            {results.page} {t("common.of")} {Math.max(1, Math.ceil(results.total / PAGE_SIZE))}
          </span>
          {results.hasMore ? (
            <Link
              href={{ pathname: "/market", query: { ...params, page: results.page + 1 } }}
              className="rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700"
            >
              {t("common.next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
