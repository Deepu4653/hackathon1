import { AlertTriangle, FlaskConical, Info, PlusCircle, Sprout } from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader, EmptyState, PageHeader, formatDate, formatNumber } from "@/components/ui";
import { ActionForm, Label, Select, SubmitButton, TextArea, TextInput } from "@/components/forms";
import { createSoilRecordAction, deleteSoilRecordAction } from "@/app/actions/crops";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { getLatestSoilRecord, interpretSoil, listSoilRecords } from "@/lib/repos/soil";
import { listFarms } from "@/lib/repos/farms";
import type { SoilRecord } from "@/lib/db/types";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("soil.title");

const SOURCE_LABEL: Record<SoilRecord["source"], string> = {
  manual: "soil.source.manual",
  lab_report: "soil.source.lab",
  dataset: "soil.source.dataset",
  estimate: "soil.source.estimate",
};

export default async function SoilPage() {
  const user = await requireUser("/soil");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const [records, latest, farms] = await Promise.all([
    listSoilRecords(user.id),
    getLatestSoilRecord(user.id),
    listFarms(user.id),
  ]);

  const readings = interpretSoil(latest);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("soil.title")}
        subtitle={t("soil.subtitle")}
        badge={<Badge tone="amber" icon={<Info className="size-3.5" aria-hidden />}>{t("soil.estimateBadge")}</Badge>}
        action={
          <a
            href="#add-soil"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white hover:bg-field-800"
          >
            <PlusCircle className="size-4" aria-hidden />
            {t("soil.add")}
          </a>
        }
      />

      <Callout tone="warning" title={t("soil.estimateNotice")}>
        {t("soil.estimateNoticeBody")}
      </Callout>

      <Card>
        <CardHeader icon={<FlaskConical className="size-5" aria-hidden />} title={t("soil.latest")} subtitle={t("soil.subtitle")} />
        <CardBody>
          {!latest ? (
            <EmptyState icon={<Sprout className="size-6" aria-hidden />} title={t("soil.noRecords")} body={t("soil.estimateNoticeBody")} />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600">
                <Badge tone={latest.source === "lab_report" ? "green" : latest.source === "manual" ? "blue" : "amber"}>
                  {t(SOURCE_LABEL[latest.source] as never)}
                </Badge>
                {latest.dataset_name ? <span>{t("soil.dataset")}: {latest.dataset_name}</span> : null}
                {latest.measured_at ? (
                  <span>
                    {t("soil.measuredOn")}: {formatDate(latest.measured_at, locale)}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {readings.map((reading) => (
                  <div key={reading.key} className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{reading.label}</p>
                    <p className="mt-1 text-2xl font-bold text-ink-900">
                      {reading.value !== null ? formatNumber(reading.value, 2) : "—"}
                      {reading.value !== null && reading.unit ? (
                        <span className="ml-1 text-xs font-medium text-ink-500">{reading.unit}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {reading.rating !== "unknown" ? (
                        <Badge tone={reading.rating === "optimal" ? "green" : reading.rating === "low" ? "blue" : "amber"}>
                          {t(`soil.hint.${reading.rating}` as never)}
                        </Badge>
                      ) : (
                        t("soil.notMeasured")
                      )}
                    </p>
                    <p className="mt-1.5 text-[0.7rem] leading-snug text-ink-400">
                      {t("soil.typicalRange")}: {reading.referenceBand}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-ink-100 p-3 text-xs leading-relaxed text-ink-500">
                <p className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-soil-600" aria-hidden />
                  {t("soil.noFabrication")}
                </p>
                {latest.dataset_reference ? (
                  <p className="mt-1">
                    {t("common.source")}: {latest.dataset_reference}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {records.length > 0 ? (
        <Card>
          <CardHeader title={t("soil.history")} />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                    <th scope="col" className="py-2.5 pr-3">{t("soil.soilType")}</th>
                    <th scope="col" className="py-2.5 pr-3">pH</th>
                    <th scope="col" className="py-2.5 pr-3">N</th>
                    <th scope="col" className="py-2.5 pr-3">P</th>
                    <th scope="col" className="py-2.5 pr-3">K</th>
                    <th scope="col" className="py-2.5 pr-3">{t("soil.moisture")}</th>
                    <th scope="col" className="py-2.5 pr-3">{t("soil.source")}</th>
                    <th scope="col" className="py-2.5">{t("soil.measuredOn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-ink-100 last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-ink-800">{record.soil_type ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-ink-600">{record.ph ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-ink-600">{record.nitrogen ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-ink-600">{record.phosphorus ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-ink-600">{record.potassium ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-ink-600">{record.moisture_pct ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-ink-600">{t(SOURCE_LABEL[record.source] as never)}</td>
                      <td className="py-2.5 text-ink-600">
                        {record.measured_at ? formatDate(record.measured_at, locale) : formatDate(record.created_at, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card id="add-soil">
        <CardHeader icon={<PlusCircle className="size-5" aria-hidden />} title={t("soil.add")} subtitle={t("soil.subtitle")} />
        <CardBody>
          <ActionForm action={createSoilRecordAction} showMessage>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label htmlFor="farm_id">{t("nav.farms")}</Label>
                    <Select id="farm_id" name="farm_id" defaultValue={farms.find((farm) => farm.is_primary)?.id ?? farms[0]?.id ?? ""}>
                      <option value="">{t("common.notAvailable")}</option>
                      {farms.map((farm) => (
                        <option key={farm.id} value={farm.id}>
                          {farm.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="soil_type">{t("soil.soilType")}</Label>
                    <Select id="soil_type" name="soil_type" defaultValue="">
                      <option value="">{t("common.notAvailable")}</option>
                      <option value="black">{t("soil.type.black")}</option>
                      <option value="red">{t("soil.type.red")}</option>
                      <option value="loamy">{t("soil.type.loamy")}</option>
                      <option value="sandy">{t("soil.type.sandy")}</option>
                      <option value="clay">{t("soil.type.clay")}</option>
                      <option value="alluvial">{t("soil.type.alluvial")}</option>
                      <option value="laterite">{t("soil.type.laterite")}</option>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="ph">{t("soil.ph")}</Label>
                    <TextInput id="ph" name="ph" type="number" step="0.1" min={0} max={14} inputMode="decimal" />
                  </div>

                  <div>
                    <Label htmlFor="source">{t("soil.source")}</Label>
                    <Select id="source" name="source" defaultValue="manual">
                      <option value="manual">{t("soil.source.manual")}</option>
                      <option value="lab_report">{t("soil.source.lab")}</option>
                      <option value="dataset">{t("soil.source.dataset")}</option>
                      <option value="estimate">{t("soil.source.estimate")}</option>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="nitrogen" hint="kg/ha">
                      {t("soil.nitrogen")}
                    </Label>
                    <TextInput id="nitrogen" name="nitrogen" type="number" step="0.1" min={0} inputMode="decimal" />
                  </div>
                  <div>
                    <Label htmlFor="phosphorus" hint="kg/ha">
                      {t("soil.phosphorus")}
                    </Label>
                    <TextInput id="phosphorus" name="phosphorus" type="number" step="0.1" min={0} inputMode="decimal" />
                  </div>
                  <div>
                    <Label htmlFor="potassium" hint="kg/ha">
                      {t("soil.potassium")}
                    </Label>
                    <TextInput id="potassium" name="potassium" type="number" step="0.1" min={0} inputMode="decimal" />
                  </div>
                  <div>
                    <Label htmlFor="moisture_pct" hint="%">
                      {t("soil.moisture")}
                    </Label>
                    <TextInput id="moisture_pct" name="moisture_pct" type="number" step="0.1" min={0} max={100} inputMode="decimal" />
                  </div>
                  <div>
                    <Label htmlFor="organic_matter_pct" hint="%">
                      {t("soil.organicMatter")}
                    </Label>
                    <TextInput id="organic_matter_pct" name="organic_matter_pct" type="number" step="0.01" min={0} max={100} inputMode="decimal" />
                  </div>
                  <div>
                    <Label htmlFor="electrical_conductivity" hint="dS/m">
                      {t("soil.ec")}
                    </Label>
                    <TextInput id="electrical_conductivity" name="electrical_conductivity" type="number" step="0.01" min={0} inputMode="decimal" />
                  </div>
                  <div>
                    <Label htmlFor="measured_at" hint={t("common.optional")}>
                      {t("soil.measuredOn")}
                    </Label>
                    <TextInput id="measured_at" name="measured_at" type="date" />
                  </div>

                  <div className="sm:col-span-2">
                    <Label htmlFor="dataset_name" hint={t("soil.datasetRequired")}>
                      {t("soil.dataset")}
                    </Label>
                    <TextInput id="dataset_name" name="dataset_name" maxLength={120} placeholder="e.g. SoilGrids 250m" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="dataset_reference" hint={t("common.optional")}>
                      {t("soil.datasetReference")}
                    </Label>
                    <TextInput id="dataset_reference" name="dataset_reference" maxLength={300} placeholder="https://…" />
                  </div>

                  <div>
                    <Label htmlFor="village" hint={t("common.optional")}>
                      {t("farms.village")}
                    </Label>
                    <TextInput id="village" name="village" maxLength={80} defaultValue={farms[0]?.village ?? ""} />
                  </div>
                  <div>
                    <Label htmlFor="district" hint={t("common.optional")}>
                      {t("farms.district")}
                    </Label>
                    <TextInput id="district" name="district" maxLength={80} defaultValue={farms[0]?.district ?? ""} />
                  </div>
                  <div>
                    <Label htmlFor="state" hint={t("common.optional")}>
                      {t("farms.state")}
                    </Label>
                    <TextInput id="state" name="state" maxLength={80} defaultValue={farms[0]?.state ?? "Andhra Pradesh"} />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <Label htmlFor="notes" hint={t("common.optional")}>
                      {t("soil.notes")}
                    </Label>
                    <TextArea id="notes" name="notes" rows={2} maxLength={500} />
                  </div>
                </div>
                <div className="mt-3">
                  <SubmitButton dataPrimary>{t("soil.add")}</SubmitButton>
                </div>
          </ActionForm>
        </CardBody>
      </Card>

      {records.length > 0 ? (
        <form action={deleteSoilRecordAction} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem]">
            <Label htmlFor="recordId">{t("soil.deleteRecord")}</Label>
            <Select id="recordId" name="recordId" defaultValue="">
              <option value="">{t("common.select")}</option>
              {records.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.soil_type ?? t("soil.title")} · {record.measured_at ?? formatDate(record.created_at, locale)}
                </option>
              ))}
            </Select>
          </div>
          <SubmitButton variant="danger">{t("common.delete")}</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
