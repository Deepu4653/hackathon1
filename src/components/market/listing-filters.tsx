"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import type { Category } from "@/lib/db/types";

/**
 * Marketplace filters. State lives in the URL, so a filtered view can be shared,
 * bookmarked and re-rendered on the server (no client-side data fetching).
 */
export function ListingFilters({
  categories,
  districts,
}: {
  categories: Category[];
  districts: string[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const current = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      kind: searchParams.get("kind") ?? "all",
      category: searchParams.get("category") ?? "",
      district: searchParams.get("district") ?? "",
      min: searchParams.get("min") ?? "",
      max: searchParams.get("max") ?? "",
      sort: searchParams.get("sort") ?? "newest",
    }),
    [searchParams],
  );

  const [term, setTerm] = useState(current.q);

  const push = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === "all") params.delete(key);
        else params.set(key, value);
      }
      params.delete("page");
      startTransition(() => router.push(`/market?${params.toString()}`));
    },
    [router, searchParams],
  );

  const activeCount = [current.kind !== "all", current.category, current.district, current.min, current.max].filter(
    Boolean,
  ).length;

  const kinds = [
    { value: "all", label: t("market.allCategories") },
    { value: "produce", label: t("market.kind.produce") },
    { value: "input", label: t("market.kind.input") },
    { value: "machinery", label: t("market.kind.machinery") },
    { value: "service", label: t("market.kind.service") },
  ];

  return (
    <div className="space-y-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          push({ q: term });
        }}
        className="flex gap-2"
      >
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={t("market.searchPlaceholder")}
          aria-label={t("common.search")}
          className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-base"
          style={{ minHeight: "var(--tap-min)" }}
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white hover:bg-field-800"
          style={{ minHeight: "var(--tap-min)" }}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("common.search")}
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 text-sm font-semibold text-ink-700 hover:border-field-300"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {t("common.filter")}
          {activeCount > 0 ? (
            <span className="grid size-5 place-items-center rounded-full bg-field-700 text-[0.65rem] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <button
            key={kind.value}
            type="button"
            onClick={() => push({ kind: kind.value })}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              current.kind === kind.value
                ? "border-field-600 bg-field-700 text-white"
                : "border-ink-200 bg-white text-ink-700 hover:border-field-300"
            }`}
          >
            {kind.label}
          </button>
        ))}
      </div>

      {open ? (
        <div className="grid gap-3 rounded-xl border border-ink-200 bg-white p-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink-700">{t("market.category")}</span>
            <select
              value={current.category}
              onChange={(event) => push({ category: event.target.value })}
              className="w-full rounded-xl border border-ink-200 px-3 py-2"
            >
              <option value="">{t("market.allCategories")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_en}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink-700">{t("market.district")}</span>
            <select
              value={current.district}
              onChange={(event) => push({ district: event.target.value })}
              className="w-full rounded-xl border border-ink-200 px-3 py-2"
            >
              <option value="">{t("prices.allDistricts")}</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink-700">{t("market.priceMin")}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={current.min}
              onBlur={(event) => push({ min: event.target.value })}
              className="w-full rounded-xl border border-ink-200 px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-semibold text-ink-700">{t("market.priceMax")}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={current.max}
              onBlur={(event) => push({ max: event.target.value })}
              className="w-full rounded-xl border border-ink-200 px-3 py-2"
            />
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-semibold text-ink-700">{t("market.sortNewest")}</span>
            <select
              value={current.sort}
              onChange={(event) => push({ sort: event.target.value })}
              className="w-full rounded-xl border border-ink-200 px-3 py-2"
            >
              <option value="newest">{t("market.sortNewest")}</option>
              <option value="price_asc">{t("market.sortPriceLow")}</option>
              <option value="price_desc">{t("market.sortPriceHigh")}</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setTerm("");
                startTransition(() => router.push("/market"));
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 px-3.5 py-2 text-sm font-semibold text-ink-600"
            >
              <X className="size-4" aria-hidden />
              {t("common.clear")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
