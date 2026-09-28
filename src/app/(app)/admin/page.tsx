import Link from "next/link";
import { Activity, AlertTriangle, Bot, MessageSquare, Package, Users } from "lucide-react";
import { Badge, Card, CardBody, Callout, CardHeader, DataRow, StatCard, formatDateTime } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { getPlatformStats, listAuditLogs, listRecentAnalyses } from "@/lib/repos/admin";
import { isGeminiConfigured } from "@/lib/gemini";
import { dataBackend } from "@/lib/env";

export const metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const { t, locale } = await getTranslatorForRequest(admin.profile.simple_mode);

  const [stats, audit, analyses] = await Promise.all([getPlatformStats(), listAuditLogs(12), listRecentAnalyses(5)]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("admin.stats.users")} value={stats.totalUsers} icon={<Users className="size-4" aria-hidden />} />
        <StatCard
          label={t("admin.stats.farmers")}
          value={stats.farmers}
          icon={<Activity className="size-4" aria-hidden />}
          tone="neutral"
        />
        <StatCard label={t("admin.stats.listings")} value={stats.activeListings} icon={<Package className="size-4" aria-hidden />} />
        <StatCard
          label={t("admin.stats.messages")}
          value={stats.messages}
          icon={<MessageSquare className="size-4" aria-hidden />}
          tone="amber"
        />
        <StatCard label={t("admin.stats.sellers")} value={stats.sellers} icon={<Users className="size-4" aria-hidden />} tone="neutral" />
        <StatCard label={t("admin.stats.totalListings")} value={stats.totalListings} icon={<Package className="size-4" aria-hidden />} tone="neutral" />
        <StatCard label={t("admin.stats.aiCalls")} value={stats.aiCallsLast7Days} icon={<Bot className="size-4" aria-hidden />} />
        <StatCard
          label={t("admin.stats.openReports")}
          value={stats.openReports}
          icon={<AlertTriangle className="size-4" aria-hidden />}
          tone={stats.openReports > 0 ? "red" : "neutral"}
        />
      </div>

      {!isGeminiConfigured() ? <Callout tone="warning" title={t("ai.notConfigured")}>{t("ai.notConfiguredBody")}</Callout> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Activity className="size-5" aria-hidden />}
            title={t("admin.auditTitle")}
            subtitle={t("admin.auditSubtitle")}
            action={
              <Link href="/admin/reports" className="text-sm font-semibold text-field-700 hover:underline">
                {t("admin.nav.reports")}
              </Link>
            }
          />
          <CardBody>
            {audit.length === 0 ? (
              <p className="text-sm text-ink-500">{t("admin.noActivity")}</p>
            ) : (
              <ul className="space-y-2">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 border-b border-ink-100 pb-2 last:border-0">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink-800">{entry.action}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {entry.entity ?? "—"} {entry.entity_id ? `· ${entry.entity_id.slice(0, 8)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-400">{formatDateTime(entry.created_at, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Bot className="size-5" aria-hidden />} title={t("admin.recentAnalyses")} subtitle={t("doctor.title")} />
          <CardBody>
            {analyses.length === 0 ? (
              <p className="text-sm text-ink-500">{t("doctor.noHistory")}</p>
            ) : (
              <ul className="space-y-2.5">
                {analyses.map((analysis) => (
                  <li key={analysis.id} className="rounded-xl border border-ink-100 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={analysis.status === "completed" ? "green" : "red"}>
                        {analysis.status === "completed" ? t("common.ok") : t("doctor.failed")}
                      </Badge>
                      <span className="text-sm font-medium text-ink-800">{analysis.crop_name ?? t("crops.name")}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-500">
                      {analysis.possible_problem ?? analysis.error_message ?? "—"}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-ink-400">{formatDateTime(analysis.created_at, locale)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("admin.platformInfo")} />
        <CardBody>
          <dl>
            <DataRow label={t("admin.stats.categories")} value={stats.categories} />
            <DataRow label={t("admin.stats.cropAnalyses")} value={stats.cropAnalyses} />
            <DataRow label={t("admin.dataBackend")} value={dataBackend()} />
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
