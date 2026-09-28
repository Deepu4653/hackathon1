import Link from "next/link";
import { Flag, ShieldAlert } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, EmptyState, formatDateTime } from "@/components/ui";
import { ActionForm, Label, Select, SubmitButton, TextArea } from "@/components/forms";
import { updateReportAction } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listReports } from "@/lib/repos/admin";

export const metadata = { title: "Admin reports" };

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin();
  const { t, locale } = await getTranslatorForRequest(admin.profile.simple_mode);

  const status = ["open", "reviewing", "resolved", "dismissed"].includes(params.status ?? "")
    ? (params.status as "open" | "reviewing" | "resolved" | "dismissed")
    : undefined;
  const reports = await listReports(status);

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-wrap gap-2">
          {["all", "open", "reviewing", "resolved", "dismissed"].map((value) => (
            <Link
              key={value}
              href={value === "all" ? "/admin/reports" : `/admin/reports?status=${value}`}
              className={`inline-flex min-h-10 items-center rounded-xl border px-3.5 text-sm font-semibold ${
                (params.status ?? "all") === value
                  ? "border-field-600 bg-field-700 text-white"
                  : "border-ink-200 bg-white text-ink-700"
              }`}
            >
              {value === "all" ? t("admin.all") : t(`admin.reportStatus.${value}` as never)}
            </Link>
          ))}
        </CardBody>
      </Card>

      {reports.length === 0 ? (
        <EmptyState icon={<Flag className="size-6" aria-hidden />} title={t("admin.noReports")} />
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id}>
              <Card>
                <CardHeader
                  icon={<ShieldAlert className="size-5" aria-hidden />}
                  title={t(`market.reportReason.${report.reason}` as never)}
                  subtitle={`${t("admin.reportedBy")}: ${report.reporter_id.slice(0, 8)} · ${formatDateTime(report.created_at, locale)}`}
                  action={<Badge tone={report.status === "open" ? "amber" : report.status === "resolved" ? "green" : "neutral"}>{t(`admin.reportStatus.${report.status}` as never)}</Badge>}
                />
                <CardBody className="space-y-3">
                  {report.details ? <p className="text-sm leading-relaxed text-ink-700">{report.details}</p> : null}
                  {report.listing_id ? (
                    <Link href={`/market/${report.listing_id}`} className="text-sm font-semibold text-field-700 hover:underline">
                      {t("admin.viewListing")}
                    </Link>
                  ) : null}

                  <ActionForm
                    action={updateReportAction}
                    showMessage
                    messageClassName="sm:col-span-3"
                    className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
                  >
                    <input type="hidden" name="reportId" value={report.id} />
                    <div>
                      <Label htmlFor={`status-${report.id}`}>{t("admin.reportStatusLabel")}</Label>
                      <Select id={`status-${report.id}`} name="status" defaultValue={report.status}>
                        <option value="open">{t("admin.reportStatus.open")}</option>
                        <option value="reviewing">{t("admin.reportStatus.reviewing")}</option>
                        <option value="resolved">{t("admin.reportStatus.resolved")}</option>
                        <option value="dismissed">{t("admin.reportStatus.dismissed")}</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor={`note-${report.id}`} hint={t("common.optional")}>
                        {t("admin.resolutionNote")}
                      </Label>
                      <TextArea id={`note-${report.id}`} name="note" rows={2} maxLength={500} defaultValue={report.resolution_note ?? ""} />
                    </div>
                    <SubmitButton variant="secondary">{t("common.save")}</SubmitButton>
                  </ActionForm>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
