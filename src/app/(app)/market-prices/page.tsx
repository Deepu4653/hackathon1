import Link from "next/link";
import { BarChart3, CalendarClock, Database, Info, TrendingUp } from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader, EmptyState, PageHeader, formatCurrency, formatDate } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { getPriceTrend, listMarketPrices, listPriceDistricts, isPriceImportConfigured } from "@/lib/market/service";
import { importMarketPricesAction } from "@/app/actions/admin";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("prices.title");

export default async function MarketPricesPage({
  searchParams,
}: {
  searchParams: Promise<{ crop?: string; district?: string; market?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser("/market-prices");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const [prices, districts, trend] = await Promise.all([
    listMarketPrices({ crop: params.crop, district: params.district, market: params.market, limit: 80 }),
    listPriceDistricts(),
    params.crop ? getPriceTrend(params.crop, params.district) : Promise.resolve([]),
  ]);

  const latestDate = prices[0]?.price_date ?? null;
  const importConfigured = isPriceImportConfigured();

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("prices.title")}
        subtitle={t("prices.subtitle")}
        badge={
          <Badge tone="blue" icon={<Database className="size-3.5" aria-hidden />}>
            {t("prices.sourceNote")}
          </Badge>
        }
        action={
          user.profile.role === "admin" ? (
            <ActionForm action={importMarketPricesAction} showMessage>
              <SubmitButton variant="secondary" disabled={!importConfigured}>
                {t("prices.import")}
              </SubmitButton>
            </ActionForm>
          ) : null
        }
      />

      <Callout tone="info" title={t("prices.realDataOnly")}>
        {t("prices.realDataOnlyBody")}
      </Callout>

      {user.profile.role === "admin" && !importConfigured ? (
        <Callout tone="warning" title={t("prices.importNotConfigured")}>
          {t("prices.importNotConfiguredBody")}
        </Callout>
      ) : null}

      <Card>
        <CardBody>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink-700">{t("prices.crop")}</span>
              <input
                name="crop"
                defaultValue={params.crop ?? ""}
                placeholder={t("prices.cropPlaceholder")}
                className="min-h-[var(--tap-min)] w-full rounded-xl border border-ink-200 px-3.5"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink-700">{t("prices.district")}</span>
              <select
                name="district"
                defaultValue={params.district ?? ""}
                className="min-h-[var(--tap-min)] w-full rounded-xl border border-ink-200 px-3"
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
              <span className="mb-1 block font-semibold text-ink-700">{t("prices.market")}</span>
              <input
                name="market"
                defaultValue={params.market ?? ""}
                placeholder={t("prices.marketPlaceholder")}
                className="min-h-[var(--tap-min)] w-full rounded-xl border border-ink-200 px-3.5"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex min-h-[var(--tap-min)] items-center rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
              >
                {t("common.search")}
              </button>
              <Link
                href="/market-prices"
                className="inline-flex min-h-[var(--tap-min)] items-center rounded-xl border border-ink-200 px-4 text-sm font-semibold text-ink-700"
              >
                {t("common.clear")}
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>

      {prices.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-6" aria-hidden />}
          title={t("prices.noData")}
          body={t("prices.noDataBody")}
        />
      ) : (
        <>
          <Card>
            <CardHeader
              icon={<CalendarClock className="size-5" aria-hidden />}
              title={t("prices.recordsTitle")}
              subtitle={
                latestDate
                  ? `${t("prices.latestDate")}: ${formatDate(latestDate, locale)}`
                  : t("common.notAvailable")
              }
            />
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                      <th scope="col" className="py-2.5 pr-3">{t("prices.crop")}</th>
                      <th scope="col" className="py-2.5 pr-3">{t("prices.market")}</th>
                      <th scope="col" className="py-2.5 pr-3">{t("prices.district")}</th>
                      <th scope="col" className="py-2.5 pr-3">{t("prices.modalPrice")}</th>
                      <th scope="col" className="py-2.5 pr-3">{t("prices.range")}</th>
                      <th scope="col" className="py-2.5 pr-3">{t("prices.date")}</th>
                      <th scope="col" className="py-2.5">{t("common.source")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((price) => (
                      <tr key={price.id} className="border-b border-ink-100 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-ink-800">
                          {price.crop_name}
                          {price.variety ? <span className="text-ink-500"> · {price.variety}</span> : null}
                        </td>
                        <td className="py-2.5 pr-3 text-ink-600">{price.market_name}</td>
                        <td className="py-2.5 pr-3 text-ink-600">{price.district ?? "—"}</td>
                        <td className="py-2.5 pr-3 font-semibold text-ink-900">
                          {formatCurrency(price.price_per_quintal)}
                          <span className="ml-1 text-xs font-normal text-ink-500">{t("prices.perQuintal")}</span>
                        </td>
                        <td className="py-2.5 pr-3 text-ink-600">
                          {price.min_price != null && price.max_price != null
                            ? `${formatCurrency(price.min_price)} – ${formatCurrency(price.max_price)}`
                            : "—"}
                        </td>
                        <td className="py-2.5 pr-3 text-ink-600">{formatDate(price.price_date, locale)}</td>
                        <td className="py-2.5 text-ink-500">
                          {price.source}
                          {price.source_url ? (
                            <a
                              href={price.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-1.5 font-semibold text-field-700 hover:underline"
                            >
                              ↗
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {trend.length > 1 ? (
            <Card>
              <CardHeader
                icon={<TrendingUp className="size-5" aria-hidden />}
                title={t("prices.trendTitle")}
                subtitle={t("prices.trendSubtitle")}
              />
              <CardBody>
                <ul className="space-y-2">
                  {trend.map((point) => {
                    const max = Math.max(...trend.map((item) => item.averagePrice));
                    const width = max > 0 ? Math.max(4, Math.round((point.averagePrice / max) * 100)) : 4;
                    return (
                      <li key={point.date} className="flex items-center gap-3 text-sm">
                        <span className="w-24 shrink-0 text-ink-500">{formatDate(point.date, locale)}</span>
                        <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                          <span className="block h-full rounded-full bg-field-500" style={{ width: `${width}%` }} />
                        </span>
                        <span className="w-28 shrink-0 text-right font-semibold text-ink-800">
                          {formatCurrency(point.averagePrice)}
                        </span>
                        <span className="w-16 shrink-0 text-right text-xs text-ink-400">
                          {point.samples} {t("prices.samples")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </>
      )}

      <Callout tone="warning" title={t("prices.disclaimerTitle")}>
        <span className="flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("prices.disclaimerBody")}
        </span>
      </Callout>
    </div>
  );
}
