import Link from "next/link";
import { Bug, History, ShieldCheck } from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader, EmptyState, PageHeader, formatDateTime } from "@/components/ui";
import { CropDoctorUploader } from "@/components/ai/crop-doctor";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listCropAnalyses } from "@/lib/repos/ai";
import { listFarms } from "@/lib/repos/farms";
import { isGeminiConfigured } from "@/lib/gemini";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("doctor.title");

export default async function CropDoctorPage() {
  const user = await requireUser("/crop-doctor");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const [analyses, farms] = await Promise.all([listCropAnalyses(user.id, 12), listFarms(user.id)]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("doctor.title")}
        subtitle={t("doctor.subtitle")}
        badge={
          <Badge tone="amber" icon={<Bug className="size-3.5" aria-hidden />}>
            {t("doctor.notADiagnosis")}
          </Badge>
        }
      />

      <Callout tone="warning" title={t("doctor.notADiagnosis")}>
        {t("doctor.disclaimer")}
      </Callout>

      <CropDoctorUploader configured={isGeminiConfigured()} farms={farms.map((farm) => ({ id: farm.id, name: farm.name }))} />

      <Card>
        <CardHeader icon={<History className="size-5" aria-hidden />} title={t("doctor.history")} subtitle={t("doctor.imageStoredPrivately")} />
        <CardBody>
          {analyses.length === 0 ? (
            <EmptyState title={t("doctor.noHistory")} body={t("doctor.noHistoryBody")} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {analyses.map((analysis) => (
                <li key={analysis.id} className="overflow-hidden rounded-xl border border-ink-100">
                  <div className="flex items-center justify-between gap-2 border-b border-ink-100 bg-ink-50/60 px-3 py-2">
                    <span className="truncate text-sm font-semibold text-ink-800">{analysis.crop_name || t("crops.name")}</span>
                    <Badge
                      tone={
                        analysis.status === "failed" ? "red" : analysis.severity === "high" ? "red" : analysis.severity === "moderate" ? "amber" : "green"
                      }
                    >
                      {analysis.status === "failed" ? t("doctor.failed") : t(`doctor.severity.${analysis.severity ?? "unknown"}` as never)}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 p-3 text-sm text-ink-700">
                    <p className="line-clamp-3 leading-relaxed">
                      {analysis.status === "completed"
                        ? analysis.possible_problem
                        : `${t("doctor.failed")} — ${t("common.retry")}`}
                    </p>
                    <p className="text-xs text-ink-400">
                      {t("common.source")}: {analysis.model ?? t("common.notAvailable")} · {formatDateTime(analysis.created_at, locale)}
                    </p>
                    {analysis.image_url ? (
                      <Link
                        href={analysis.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-field-700 hover:underline"
                      >
                        <ShieldCheck className="size-3.5" aria-hidden />
                        {t("doctor.viewPhoto")}
                      </Link>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
