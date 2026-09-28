import { CalendarDays, Droplets, PlusCircle, Sprout, Wheat } from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  formatDate,
  formatNumber,
} from "@/components/ui";
import { ActionForm, Label, Select, SubmitButton, TextArea, TextInput } from "@/components/forms";
import { createCropRecordAction, updateCropRecordAction, deleteCropRecordAction } from "@/app/actions/crops";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listCropCatalogue, listCropRecords } from "@/lib/repos/crops";
import { listFarms } from "@/lib/repos/farms";

export const metadata = { title: "My crops" };

const ACTIVE_STATUSES = ["planned", "sown", "growing"] as const;

export default async function CropsPage() {
  const user = await requireUser("/crops");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const [records, farms, catalogue] = await Promise.all([
    listCropRecords(user.id),
    listFarms(user.id),
    listCropCatalogue(),
  ]);
  const active = records.filter((record) => (ACTIVE_STATUSES as readonly string[]).includes(record.status));
  const nextHarvest = active.find((record) => record.expected_harvest_date)?.expected_harvest_date ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("crops.title")}
        subtitle={t("crops.subtitle")}
        action={
          <a
            href="#add-crop"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white hover:bg-field-800"
          >
            <PlusCircle className="size-4" aria-hidden />
            {t("crops.addRecord")}
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-field-100 text-field-700">
              <Wheat className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-ink-500">{t("crops.active")}</p>
              <p className="text-xl font-bold text-ink-900">{active.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-soil-100 text-soil-700">
              <Sprout className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-ink-500">{t("farms.totalArea")}</p>
              <p className="text-xl font-bold text-ink-900">
                {formatNumber(
                  records.reduce((sum, record) => sum + (Number(record.area_acres) || 0), 0),
                  2,
                )}{" "}
                <span className="text-xs font-medium text-ink-500">{t("crops.area")}</span>
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-info-100 text-info-700">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-xs text-ink-500">{t("crops.harvestDate")}</p>
              <p className="text-sm font-bold text-ink-900">
                {nextHarvest ? formatDate(nextHarvest, locale) : t("common.notAvailable")}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={<Wheat className="size-6" aria-hidden />} title={t("crops.noRecords")} body={t("crops.subtitle")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {records.map((record) => (
            <li key={record.id}>
              <Card className="h-full">
                <CardHeader
                  title={record.crop_name}
                  subtitle={record.variety ?? undefined}
                  action={
                    <Badge
                      tone={
                        record.status === "failed"
                          ? "red"
                          : record.status === "harvested"
                            ? "neutral"
                            : "green"
                      }
                    >
                      {record.status === "sown" ? t("crops.status.sown") : t(`crops.status.${record.status}` as never)}
                    </Badge>
                  }
                />
                <CardBody className="space-y-2.5">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-ink-500">{t("crops.season")}</dt>
                      <dd className="font-medium text-ink-800">{t(`crops.season.${record.season}` as never)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">{t("crops.area")}</dt>
                      <dd className="font-medium text-ink-800">
                        {record.area_acres ? `${formatNumber(Number(record.area_acres), 2)} ac` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">{t("crops.sowingDate")}</dt>
                      <dd className="font-medium text-ink-800">
                        {record.sowing_date ? formatDate(record.sowing_date, locale) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1 text-xs text-ink-500">
                        <Droplets className="size-3" aria-hidden />
                        {t("crops.harvestDate")}
                      </dt>
                      <dd className="font-medium text-ink-800">
                        {record.expected_harvest_date ? formatDate(record.expected_harvest_date, locale) : "—"}
                      </dd>
                    </div>
                  </dl>

                  {record.notes ? <p className="text-sm text-ink-600">{record.notes}</p> : null}

                  <details className="rounded-xl border border-ink-100">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ink-700">{t("common.edit")}</summary>
                    <div className="border-t border-ink-100 p-3">
                      <ActionForm action={updateCropRecordAction} showMessage>
                            <input type="hidden" name="recordId" value={record.id} />
                            <input type="hidden" name="crop_name" value={record.crop_name} />
                            <input type="hidden" name="season" value={record.season} />
                            <input type="hidden" name="area_acres" value={record.area_acres ?? ""} />
                            <input type="hidden" name="variety" value={record.variety ?? ""} />
                            <div className="grid gap-2.5 sm:grid-cols-2">
                              <div>
                                <Label htmlFor={`status-${record.id}`}>{t("crops.status")}</Label>
                                <Select id={`status-${record.id}`} name="status" defaultValue={record.status}>
                                  <option value="planned">{t("crops.status.planned")}</option>
                                  <option value="sown">{t("crops.status.sown")}</option>
                                  <option value="growing">{t("crops.status.growing")}</option>
                                  <option value="harvested">{t("crops.status.harvested")}</option>
                                  <option value="failed">{t("crops.status.failed")}</option>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`harvest-${record.id}`}>{t("crops.harvestDate")}</Label>
                                <TextInput
                                  id={`harvest-${record.id}`}
                                  name="expected_harvest_date"
                                  type="date"
                                  defaultValue={record.expected_harvest_date ?? ""}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <Label htmlFor={`notes-${record.id}`}>{t("crops.notes")}</Label>
                                <TextArea
                                  id={`notes-${record.id}`}
                                  name="notes"
                                  rows={2}
                                  defaultValue={record.notes ?? ""}
                                  maxLength={500}
                                />
                              </div>
                            </div>
                            <div className="mt-3">
                              <SubmitButton variant="secondary">{t("common.save")}</SubmitButton>
                            </div>
                      </ActionForm>

                      <form action={deleteCropRecordAction} className="mt-2">
                        <input type="hidden" name="recordId" value={record.id} />
                        <button type="submit" className="text-sm font-semibold text-danger-600 hover:underline">
                          {t("common.delete")}
                        </button>
                      </form>
                    </div>
                  </details>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card id="add-crop">
        <CardHeader icon={<PlusCircle className="size-5" aria-hidden />} title={t("crops.addRecord")} subtitle={t("crops.subtitle")} />
        <CardBody>
          <ActionForm action={createCropRecordAction} showMessage>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="farm_id">{t("nav.farms")}</Label>
                    <Select
                      id="farm_id"
                      name="farm_id"
                      defaultValue={farms.find((farm) => farm.is_primary)?.id ?? farms[0]?.id ?? ""}
                    >
                      <option value="">{t("common.notAvailable")}</option>
                      {farms.map((farm) => (
                        <option key={farm.id} value={farm.id}>
                          {farm.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="crop_name">{t("crops.name")}</Label>
                    <TextInput id="crop_name" name="crop_name" list="crop-options" required maxLength={80} />
                    <datalist id="crop-options">
                      {catalogue.map((crop) => (
                        <option key={crop.id} value={crop.name_en} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <Label htmlFor="variety" hint={t("common.optional")}>
                      {t("crops.variety")}
                    </Label>
                    <TextInput id="variety" name="variety" maxLength={80} />
                  </div>

                  <div>
                    <Label htmlFor="season">{t("crops.season")}</Label>
                    <Select id="season" name="season" defaultValue="kharif">
                      <option value="kharif">{t("crops.season.kharif")}</option>
                      <option value="rabi">{t("crops.season.rabi")}</option>
                      <option value="zaid">{t("crops.season.zaid")}</option>
                      <option value="perennial">{t("crops.season.perennial")}</option>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="area_acres" hint={t("common.optional")}>
                      {t("crops.area")}
                    </Label>
                    <TextInput id="area_acres" name="area_acres" type="number" step="0.01" min={0} inputMode="decimal" />
                  </div>

                  <div>
                    <Label htmlFor="sowing_date" hint={t("common.optional")}>
                      {t("crops.sowingDate")}
                    </Label>
                    <TextInput id="sowing_date" name="sowing_date" type="date" />
                  </div>

                  <div>
                    <Label htmlFor="expected_harvest_date" hint={t("common.optional")}>
                      {t("crops.harvestDate")}
                    </Label>
                    <TextInput id="expected_harvest_date" name="expected_harvest_date" type="date" />
                  </div>

                  <div>
                    <Label htmlFor="status">{t("crops.status")}</Label>
                    <Select id="status" name="status" defaultValue="growing">
                      <option value="planned">{t("crops.status.planned")}</option>
                      <option value="sown">{t("crops.status.sown")}</option>
                      <option value="growing">{t("crops.status.growing")}</option>
                      <option value="harvested">{t("crops.status.harvested")}</option>
                      <option value="failed">{t("crops.status.failed")}</option>
                    </Select>
                  </div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label htmlFor="notes" hint={t("common.optional")}>
                      {t("crops.notes")}
                    </Label>
                    <TextArea id="notes" name="notes" rows={2} maxLength={500} />
                  </div>
                </div>
                <div className="mt-3">
                  <SubmitButton dataPrimary>{t("common.save")}</SubmitButton>
                </div>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
