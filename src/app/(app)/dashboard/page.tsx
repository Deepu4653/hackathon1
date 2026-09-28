import Link from "next/link";
import {
  ArrowRight,
  Bug,
  Heart,
  MapPin,
  MessageSquare,
  PlusCircle,
  Sprout,
  Store,
  TrendingUp,
  Wheat,
} from "lucide-react";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  StatCard,
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/components/ui";
import { LiveWeather } from "@/components/weather/live-weather";
import { WeatherPanel } from "@/components/weather/weather-panel";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listFarms } from "@/lib/repos/farms";
import { getActiveCropRecords, listCropRecords } from "@/lib/repos/crops";
import { interpretSoil, getLatestSoilRecord } from "@/lib/repos/soil";
import { listMarketPrices } from "@/lib/market/service";
import { listMyListings } from "@/lib/repos/listings";
import { listCropAnalyses } from "@/lib/repos/ai";
import { countUnreadMessages, listNotifications } from "@/lib/repos/messaging";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { saveWeatherAction } from "@/app/actions/weather";
import { SubmitButton } from "@/components/forms";
import { isGeminiConfigured } from "@/lib/gemini";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; error?: string; saved?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser("/dashboard");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const [farms, activeCrops, allCrops, soil, prices, myListings, analyses, unreadMessages, notifications] =
    await Promise.all([
      listFarms(user.id),
      getActiveCropRecords(user.id),
      listCropRecords(user.id),
      getLatestSoilRecord(user.id),
      listMarketPrices({ crop: "", limit: 8 }),
      listMyListings(user.id),
      listCropAnalyses(user.id, 3),
      countUnreadMessages(user.id),
      listNotifications(user.id, 4),
    ]);

  const primaryFarm = farms.find((farm) => farm.is_primary) ?? farms[0] ?? null;
  const weather =
    primaryFarm?.latitude != null && primaryFarm?.longitude != null
      ? await fetchWeather(primaryFarm.latitude, primaryFarm.longitude)
      : null;

  const soilReadings = interpretSoil(soil).filter((reading) => reading.value !== null);
  const activeListings = myListings.filter((listing) => listing.status === "active");

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${t("dash.greeting")}, ${user.profile.full_name.split(" ")[0] || ""}`}
        subtitle={t("dash.subtitle")}
        badge={<Badge tone="green">{t("app.tagline")}</Badge>}
        action={
          <Link
            href="/assistant"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white hover:bg-field-800"
          >
            <Sprout className="size-4" aria-hidden />
            {t("dash.askAi")}
          </Link>
        }
      />

      {params.welcome ? (
        <Callout tone="success" title={t("dash.greeting")}>
          {t("dash.noFarmBody")}
        </Callout>
      ) : null}
      {params.error === "forbidden" ? (
        <Callout tone="warning" title={t("auth.forbidden")} />
      ) : null}
      {params.error === "rate-limited" ? (
        <Callout tone="warning" title={t("ai.rateLimited")} />
      ) : null}

      {(!user.profile.district || !user.profile.phone) && (
        <Callout tone="info" title={t("dash.profileIncomplete")}>
          {t("dash.profileIncompleteBody")}{" "}
          <Link href="/profile" className="font-semibold underline">
            {t("profile.saveButton")}
          </Link>
        </Callout>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="weather-heading" className="space-y-3">
          <h2 id="weather-heading" className="text-lg font-bold text-ink-900">
            {t("dash.weatherTitle")}
          </h2>

          {!primaryFarm ? (
            <EmptyState
              icon={<MapPin className="size-6" aria-hidden />}
              title={t("dash.noFarmTitle")}
              body={t("dash.noFarmBody")}
              action={
                <Link
                  href="/farms"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
                >
                  <PlusCircle className="size-4" aria-hidden />
                  {t("dash.addFarm")}
                </Link>
              }
            />
          ) : weather?.ok ? (
            <>
              <WeatherPanel snapshot={weather.snapshot} t={t} locale={locale} compact />
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/weather"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 hover:border-field-300"
                >
                  {t("dash.openWeather")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <form action={saveWeatherAction}>
                  <input type="hidden" name="farmId" value={primaryFarm.id} />
                  <input type="hidden" name="latitude" value={primaryFarm.latitude ?? ""} />
                  <input type="hidden" name="longitude" value={primaryFarm.longitude ?? ""} />
                  <SubmitButton variant="ghost">{t("weather.saveToFarm")}</SubmitButton>
                </form>
              </div>
            </>
          ) : primaryFarm.latitude != null && primaryFarm.longitude != null ? (
            <div className="space-y-3">
              <LiveWeather latitude={primaryFarm.latitude} longitude={primaryFarm.longitude} compact />
              <Link
                href="/weather"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 hover:border-field-300"
              >
                {t("dash.openWeather")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <Callout tone="warning" title={t("dash.weatherUnavailable")}>
              {t("weather.selectLocation")} —{" "}
              <Link href="/weather" className="font-semibold underline">
                {t("weather.changeLocation")}
              </Link>
            </Callout>
          )}
        </section>

        <section aria-labelledby="alerts-heading" className="space-y-3">
          <h2 id="alerts-heading" className="text-lg font-bold text-ink-900">
            {t("dash.alertsTitle")}
          </h2>
          <Card>
            <CardBody className="space-y-2.5">
              {notifications.length === 0 ? (
                <p className="text-sm text-ink-500">{t("dash.noAlerts")}</p>
              ) : (
                notifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={notification.link ?? "/notifications"}
                    className="flex items-start gap-2.5 rounded-xl border border-ink-100 px-3 py-2.5 hover:border-field-300 hover:bg-field-50"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        notification.severity === "critical"
                          ? "bg-danger-500"
                          : notification.severity === "warning"
                            ? "bg-soil-500"
                            : "bg-field-500"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-800">
                        {notification.type === "weather_alert" ? t("weather.alerts") : notification.title}
                      </span>
                      <span className="block truncate text-xs text-ink-500">
                        {notification.body ?? notification.title}
                      </span>
                    </span>
                  </Link>
                ))
              )}
              <Link href="/notifications" className="inline-block text-sm font-semibold text-field-700 hover:underline">
                {t("notifications.viewAll")}
              </Link>
            </CardBody>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t("dash.activeCrops")} value={activeCrops.length} icon={<Wheat className="size-4" aria-hidden />} />
            <StatCard
              label={t("dash.unreadMessages")}
              value={unreadMessages}
              icon={<MessageSquare className="size-4" aria-hidden />}
              tone="amber"
            />
            <StatCard label={t("dash.myListings")} value={activeListings.length} icon={<Store className="size-4" aria-hidden />} />
            <StatCard
              label={t("dash.analysisHistory")}
              value={analyses.length}
              icon={<Bug className="size-4" aria-hidden />}
              tone="neutral"
            />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Wheat className="size-5" aria-hidden />}
            title={t("dash.cropsTitle")}
            action={
              <Link href="/crops" className="text-sm font-semibold text-field-700 hover:underline">
                {t("common.viewAll")}
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {allCrops.length === 0 ? (
              <EmptyState
                title={t("crops.noRecords")}
                action={
                  <Link
                    href="/crops"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
                  >
                    <PlusCircle className="size-4" aria-hidden />
                    {t("crops.addRecord")}
                  </Link>
                }
              />
            ) : (
              allCrops.slice(0, 4).map((crop) => (
                <div key={crop.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{crop.crop_name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {t(`crops.season.${crop.season}` as never)} · {t(`crops.status.${crop.status}` as never)}
                      {crop.area_acres ? ` · ${formatNumber(crop.area_acres, 1)} ${t("crops.area")}` : ""}
                    </p>
                  </div>
                  {crop.sowing_date ? (
                    <span className="shrink-0 text-xs text-ink-400">{formatDate(crop.sowing_date, locale)}</span>
                  ) : null}
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Sprout className="size-5" aria-hidden />}
            title={t("dash.soilSummary")}
            action={
              <Link href="/soil" className="text-sm font-semibold text-field-700 hover:underline">
                {t("common.viewAll")}
              </Link>
            }
          />
          <CardBody>
            {soilReadings.length === 0 ? (
              <EmptyState
                title={t("dash.noSoil")}
                body={t("soil.estimateNotice")}
                action={
                  <Link
                    href="/soil"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
                  >
                    {t("dash.addSoil")}
                  </Link>
                }
              />
            ) : (
              <dl className="grid grid-cols-2 gap-3">
                {soilReadings.slice(0, 4).map((reading) => (
                  <div key={reading.key} className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                    <dt className="text-xs font-medium text-ink-500">{reading.label}</dt>
                    <dd className="mt-1 text-lg font-bold text-ink-900">
                      {formatNumber(reading.value, 2)}
                      {reading.unit ? <span className="ml-1 text-xs font-normal text-ink-500">{reading.unit}</span> : null}
                    </dd>
                    <dd className="mt-0.5 text-xs font-medium text-field-700">
                      {reading.rating === "optimal"
                        ? t("soil.hint.optimal")
                        : reading.rating === "low"
                          ? t("soil.hint.low")
                          : reading.rating === "high"
                            ? t("soil.hint.high")
                            : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<TrendingUp className="size-5" aria-hidden />}
            title={t("dash.marketTitle")}
            action={
              <Link href="/market-prices" className="text-sm font-semibold text-field-700 hover:underline">
                {t("common.viewAll")}
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {prices.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-ink-500">{t("prices.noData")}</p>
                <p className="text-xs text-ink-400">{t("prices.noDataHelp")}</p>
              </div>
            ) : (
              prices.slice(0, 5).map((price) => (
                <div key={price.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">{price.crop_name}</p>
                    <p className="truncate text-xs text-ink-500">
                      {price.market_name}
                      {price.district ? `, ${price.district}` : ""} · {formatDate(price.price_date, locale)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-ink-900">{formatCurrency(price.price_per_quintal)}</p>
                    <p className="text-[0.7rem] text-ink-400">{t("prices.perQuintal")}</p>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Store className="size-5" aria-hidden />}
            title={t("dash.quickActions")}
          />
          <CardBody className="grid gap-2 sm:grid-cols-2">
            {[
              { href: "/listings/new", label: t("market.create"), icon: PlusCircle },
              { href: "/crop-doctor", label: t("nav.cropDoctor"), icon: Bug },
              { href: "/messages", label: t("nav.messages"), icon: MessageSquare },
              { href: "/favorites", label: t("dash.savedListings"), icon: Heart },
              { href: "/recommendation", label: t("nav.recommend"), icon: Wheat },
              { href: "/market", label: t("nav.market"), icon: Store },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm font-semibold text-ink-800 transition hover:border-field-300 hover:bg-field-50"
                >
                  <Icon className="size-4 text-field-700" aria-hidden />
                  <span className="truncate">{action.label}</span>
                </Link>
              );
            })}
            {!isGeminiConfigured() ? (
              <p className="sm:col-span-2 rounded-xl bg-soil-50 px-3 py-2 text-xs text-soil-800">{t("ai.notConfigured")}</p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
