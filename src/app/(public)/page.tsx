import Link from "next/link";
import {
  Bug,
  CloudSun,
  Heading,
  MapPin,
  MessageSquare,
  Package,
  ShieldCheck,
  Sparkles,
  Sprout,
  Store,
  TrendingUp,
  Users,
  Wheat,
} from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader } from "@/components/ui";
import { getTranslatorForRequest } from "@/lib/preferences";
import { dataBackend, publicEnv } from "@/lib/env";
import { isGeminiConfigured, isMapboxConfigured, isSupabaseConfigured, isPriceImportConfigured } from "@/lib/integrations";

export const metadata = {
  title: "X-FARM AI — one platform, every farm need",
};

/** Where each credential is issued, so setup is one click instead of a hunt. */
const KEY_SOURCES: Record<string, string> = {
  GEMINI_API_KEY: "https://aistudio.google.com/apikey",
  NEXT_PUBLIC_MAPBOX_TOKEN: "https://account.mapbox.com/access-tokens/",
  DATA_GOV_IN_API_KEY: "https://data.gov.in/user/register",
};

function supabaseKeysUrl(): string {
  const match = publicEnv.supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/);
  return match
    ? `https://supabase.com/dashboard/project/${match[1]}/settings/api-keys`
    : "https://supabase.com/dashboard";
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ signedOut?: string }>;
}) {
  const params = await searchParams;
  const { t } = await getTranslatorForRequest();
  const gemini = isGeminiConfigured();
  const localBackend = dataBackend() === "local";
  const missing: string[] = [];

  const supabaseKeys = supabaseKeysUrl();
  if (!isSupabaseConfigured()) missing.push("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!gemini) missing.push("GEMINI_API_KEY");
  if (!isMapboxConfigured()) missing.push("NEXT_PUBLIC_MAPBOX_TOKEN");

  const features = [
    { icon: CloudSun, title: t("home.featureWeatherTitle"), body: t("home.featureWeatherBody"), href: "/weather" },
    { icon: Sparkles, title: t("home.featureAiTitle"), body: t("home.featureAiBody"), href: "/assistant" },
    { icon: Bug, title: t("home.featureDoctorTitle"), body: t("home.featureDoctorBody"), href: "/crop-doctor" },
    { icon: Wheat, title: t("home.featureRecommendTitle"), body: t("home.featureRecommendBody"), href: "/recommendation" },
    { icon: Store, title: t("home.featureMarketTitle"), body: t("home.featureMarketBody"), href: "/market" },
    { icon: TrendingUp, title: t("home.featurePricesTitle"), body: t("home.featurePricesBody"), href: "/market-prices" },
    { icon: MapPin, title: t("home.featureMapTitle"), body: t("home.featureMapBody"), href: "/map" },
    { icon: MessageSquare, title: t("home.featureMessagesTitle"), body: t("home.featureMessagesBody"), href: "/messages" },
  ];

  const roles = [
    { icon: Sprout, key: "farmer" },
    { icon: Package, key: "seller" },
    { icon: Store, key: "buyer" },
    { icon: Users, key: "distributor" },
    { icon: Heading, key: "machine_owner" },
    { icon: ShieldCheck, key: "admin" },
  ] as const;

  return (
    <div className="space-y-8">
      {params.signedOut ? (
        <Callout tone="success" title={t("auth.signedOut")}>
          {t("auth.signedOutBody")}
        </Callout>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <div className="space-y-4">
          <Badge tone="green" icon={<Sprout className="size-3.5" aria-hidden />}>
            {t("app.name")} · {t("app.tagline")}
          </Badge>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-ink-900 sm:text-4xl">
            {t("home.heroTitle")}
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-ink-600">{t("home.heroBody")}</p>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-field-700 px-5 text-sm font-semibold text-white hover:bg-field-800"
            >
              {t("home.createAccount")}
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-800 hover:border-field-300"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/market"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-ink-200 bg-white px-5 text-sm font-semibold text-ink-800 hover:border-field-300"
            >
              {t("home.browseMarket")}
            </Link>
          </div>
          <p className="text-xs leading-relaxed text-ink-500">{t("home.languageNote")}</p>
        </div>

        <Card>
          <CardHeader title={t("home.quickStartTitle")} subtitle={t("home.quickStartSubtitle")} />
          <CardBody>
            <ol className="space-y-3">
              {[t("home.step1"), t("home.step2"), t("home.step3"), t("home.step4")].map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-700">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-field-100 text-xs font-bold text-field-800">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="features">
        <h2 id="features" className="mb-1 text-2xl font-bold tracking-tight text-ink-900">
          {t("home.featuresTitle")}
        </h2>
        <p className="mb-4 text-sm text-ink-500">{t("home.featuresSubtitle")}</p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title}>
                <Card className="h-full">
                  <CardBody className="space-y-2">
                    <span className="grid size-10 place-items-center rounded-xl bg-field-50 text-field-700">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="text-sm font-bold text-ink-900">{feature.title}</h3>
                    <p className="text-sm leading-relaxed text-ink-600">{feature.body}</p>
                    <Link href={feature.href} className="inline-block text-sm font-semibold text-field-700 hover:underline">
                      {t("home.open")}
                    </Link>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="roles">
        <h2 id="roles" className="mb-1 text-2xl font-bold tracking-tight text-ink-900">
          {t("home.rolesTitle")}
        </h2>
        <p className="mb-4 text-sm text-ink-500">{t("home.rolesSubtitle")}</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <li key={role.key}>
                <Card>
                  <CardBody className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-soil-50 text-soil-700">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-ink-900">{t(`auth.role.${role.key}` as never)}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-600">{t(`home.role.${role.key}` as never)}</p>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<ShieldCheck className="size-5" aria-hidden />} title={t("home.trustTitle")} />
          <CardBody className="space-y-3 text-sm leading-relaxed text-ink-600">
            <p>{t("home.trust1")}</p>
            <p>{t("home.trust2")}</p>
            <p>{t("home.trust3")}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<CloudSun className="size-5" aria-hidden />} title={t("home.dataTitle")} />
          <CardBody className="space-y-2.5 text-sm leading-relaxed text-ink-600">
            <p>{t("home.data1")}</p>
            <p>{t("home.data2")}</p>
            <p>{t("home.data3")}</p>
            <p>{t("home.data4")}</p>
            {!isPriceImportConfigured() ? (
              <p className="rounded-xl bg-soil-50 px-3 py-2 text-xs text-soil-800">
                {t("prices.importNotConfiguredBody")}{" "}
                <a
                  href={KEY_SOURCES.DATA_GOV_IN_API_KEY}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans font-semibold text-field-700 underline"
                >
                  {t("common.whereToGet")}
                </a>
              </p>
            ) : null}
          </CardBody>
        </Card>
      </section>

      {missing.length > 0 ? (
        <Callout tone="info" title={t("home.setupTitle")}>
          <p>{t("common.missingEnv")}:</p>
          <ul className="mt-1 list-disc pl-5 font-mono text-xs">
            {missing.map((variable) => {
              const source = variable.startsWith("NEXT_PUBLIC_SUPABASE_URL") ? supabaseKeys : KEY_SOURCES[variable];
              return (
                <li key={variable}>
                  {variable}
                  {source ? (
                    <>
                      {" — "}
                      <a
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans font-semibold text-field-700 underline"
                      >
                        {t("common.whereToGet")}
                      </a>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs">{t("home.setupBody")}</p>
        </Callout>
      ) : null}

      {localBackend && isSupabaseConfigured() ? (
        <Callout tone="info" title={t("home.setupTitle")}>
          <p className="text-xs">{t("home.localBackendNote")}</p>
        </Callout>
      ) : null}

      <section className="rounded-[var(--radius-card)] border border-field-200 bg-field-50 px-4 py-5 sm:px-6">
        <h2 className="text-xl font-bold tracking-tight text-field-900">{t("home.ctaTitle")}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-field-800">{t("home.ctaBody")}</p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center rounded-xl bg-field-700 px-4 text-sm font-semibold text-white hover:bg-field-800"
          >
            {t("home.createAccount")}
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-xl border border-field-300 bg-white px-4 text-sm font-semibold text-field-800"
          >
            {t("nav.login")}
          </Link>
        </div>
      </section>

      <p className="text-center text-xs leading-relaxed text-ink-500">{t("home.footerNote")}</p>
    </div>
  );
}
