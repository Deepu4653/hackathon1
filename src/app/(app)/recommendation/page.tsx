import { BookOpen, Lightbulb } from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader, PageHeader, formatNumber } from "@/components/ui";
import { CropRecommender } from "@/components/ai/recommendation-form";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listCropCatalogue, listCropRecords } from "@/lib/repos/crops";
import { getPrimaryFarm } from "@/lib/repos/farms";
import { getLatestSoilRecord } from "@/lib/repos/soil";
import { isGeminiConfigured } from "@/lib/gemini";
import { localisedName } from "@/lib/i18n";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("recommend.title");

export default async function RecommendationPage() {
  const user = await requireUser("/recommendation");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const [farm, soil, records, catalogue] = await Promise.all([
    getPrimaryFarm(user.id),
    getLatestSoilRecord(user.id),
    listCropRecords(user.id),
    listCropCatalogue(),
  ]);

  const lastCrop = records[0]?.crop_name ?? "";
  const location =
    [farm?.village, farm?.district, farm?.state].filter(Boolean).join(", ") ||
    [user.profile.village, user.profile.district, user.profile.state].filter(Boolean).join(", ") ||
    "";

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("recommend.title")}
        subtitle={t("recommend.subtitle")}
        badge={
          <Badge tone="green" icon={<Lightbulb className="size-3.5" aria-hidden />}>
            {t("recommend.badge")}
          </Badge>
        }
      />

      <Callout tone="critical" title={t("recommend.noGuarantee")}>
        {t("recommend.disclaimer")}
      </Callout>

      <CropRecommender
        configured={isGeminiConfigured()}
        defaults={{
          location,
          soilType: soil?.soil_type ?? farm?.soil_type ?? "",
          ph: soil?.ph != null ? String(soil.ph) : "",
          water: farm?.irrigation_source === "rainfed" ? "low" : farm?.irrigation_source ? "high" : "medium",
          farmSize: farm?.size_acres != null ? String(farm.size_acres) : "",
          previousCrop: lastCrop,
          language: locale,
        }}
      />

      <Card>
        <CardHeader
          icon={<BookOpen className="size-5" aria-hidden />}
          title={t("recommend.reference")}
          subtitle={t("recommend.referenceNote")}
        />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th scope="col" className="py-2.5 pr-3">{t("crops.name")}</th>
                  <th scope="col" className="py-2.5 pr-3">{t("crops.season")}</th>
                  <th scope="col" className="py-2.5 pr-3">{t("recommend.duration")}</th>
                  <th scope="col" className="py-2.5 pr-3">{t("recommend.waterNeed")}</th>
                  <th scope="col" className="py-2.5">{t("recommend.soilType")}</th>
                </tr>
              </thead>
              <tbody>
                {catalogue.map((crop) => (
                  <tr key={crop.id} className="border-b border-ink-100 last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-ink-800">{localisedName(crop, locale)}</td>
                    <td className="py-2.5 pr-3 text-ink-600">{crop.seasons.join(", ") || "—"}</td>
                    <td className="py-2.5 pr-3 text-ink-600">
                      {crop.duration_days != null ? `${formatNumber(crop.duration_days, 0)} ${t("crops.days")}` : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-600">
                      {crop.water_need
                        ? ["low", "medium", "high"].includes(crop.water_need)
                          ? t(`recommend.water.${crop.water_need}` as never)
                          : crop.water_need
                        : "—"}
                    </td>
                    <td className="py-2.5 text-ink-600">{crop.soil_types.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
