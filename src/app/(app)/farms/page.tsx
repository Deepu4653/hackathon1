import { MapPin, Pencil, PlusCircle, Star, Trash2 } from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader, EmptyState, PageHeader, formatNumber } from "@/components/ui";
import { ActionForm, Label, Select, SubmitButton, TextArea, TextInput } from "@/components/forms";
import { createFarmAction, updateFarmAction, deleteFarmAction, setPrimaryFarmAction } from "@/app/actions/farms";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listFarms } from "@/lib/repos/farms";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("farms.title");

export default async function FarmsPage() {
  const user = await requireUser("/farms");
  const { t } = await getTranslatorForRequest(user.profile.simple_mode);
  const farms = await listFarms(user.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("farms.title")}
        subtitle={t("farms.subtitle")}
        action={
          <a
            href="#add-farm"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white hover:bg-field-800"
          >
            <PlusCircle className="size-4" aria-hidden />
            {t("farms.add")}
          </a>
        }
      />

      <Callout tone="info" title={t("farms.locationTitle")}>
        {t("farms.locationBody")}
      </Callout>

      {farms.length === 0 ? (
        <EmptyState icon={<MapPin className="size-6" aria-hidden />} title={t("farms.noFarms")} body={t("farms.noFarmsBody")} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {farms.map((farm) => (
            <li key={farm.id}>
              <Card className="h-full">
                <CardHeader
                  title={farm.name}
                  subtitle={[farm.village, farm.district, farm.state].filter(Boolean).join(", ") || t("common.notAvailable")}
                  action={farm.is_primary ? <Badge tone="green">{t("farms.primaryBadge")}</Badge> : null}
                />
                <CardBody className="space-y-3">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-ink-500">{t("farms.size")}</dt>
                      <dd className="font-medium text-ink-800">
                        {farm.size_acres != null ? `${formatNumber(Number(farm.size_acres), 2)} ${t("crops.area")}` : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">{t("soil.soilType")}</dt>
                      <dd className="font-medium text-ink-800">{farm.soil_type ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">{t("farms.irrigation")}</dt>
                      <dd className="font-medium text-ink-800">{farm.irrigation_source?.replace(/_/g, " ") ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-500">{t("map.coordinates")}</dt>
                      <dd className="font-medium text-ink-800">
                        {farm.latitude != null && farm.longitude != null
                          ? `${farm.latitude.toFixed(3)}, ${farm.longitude.toFixed(3)}`
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {farm.notes ? <p className="text-sm text-ink-600">{farm.notes}</p> : null}

                  <div className="flex flex-wrap gap-2">
                    {!farm.is_primary ? (
                      <form action={setPrimaryFarmAction}>
                        <input type="hidden" name="farmId" value={farm.id} />
                        <SubmitButton variant="secondary">
                          <Star className="size-4" aria-hidden />
                          {t("farms.setPrimary")}
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>

                  <details className="rounded-xl border border-ink-100">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ink-700">
                      <Pencil className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden />
                      {t("common.edit")}
                    </summary>
                    <div className="border-t border-ink-100 p-3">
                      <ActionForm action={updateFarmAction} showMessage>
                            <input type="hidden" name="farmId" value={farm.id} />
                            <div className="grid gap-2.5 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <Label htmlFor={`name-${farm.id}`}>{t("farms.name")}</Label>
                                <TextInput id={`name-${farm.id}`} name="name" defaultValue={farm.name} required maxLength={120} />
                              </div>
                              <div>
                                <Label htmlFor={`size-${farm.id}`}>{t("farms.size")}</Label>
                                <TextInput
                                  id={`size-${farm.id}`}
                                  name="size_acres"
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  inputMode="decimal"
                                  defaultValue={farm.size_acres != null ? Number(farm.size_acres) : ""}
                                />
                              </div>
                              <div>
                                <Label htmlFor={`soil-${farm.id}`}>{t("soil.soilType")}</Label>
                                <Select id={`soil-${farm.id}`} name="soil_type" defaultValue={farm.soil_type ?? ""}>
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
                                <Label htmlFor={`village-${farm.id}`}>{t("farms.village")}</Label>
                                <TextInput id={`village-${farm.id}`} name="village" defaultValue={farm.village ?? ""} maxLength={80} />
                              </div>
                              <div>
                                <Label htmlFor={`district-${farm.id}`}>{t("farms.district")}</Label>
                                <TextInput id={`district-${farm.id}`} name="district" defaultValue={farm.district ?? ""} maxLength={80} />
                              </div>
                              <div>
                                <Label htmlFor={`state-${farm.id}`}>{t("farms.state")}</Label>
                                <TextInput id={`state-${farm.id}`} name="state" defaultValue={farm.state ?? "Andhra Pradesh"} maxLength={80} />
                              </div>
                              <div>
                                <Label htmlFor={`irrigation-${farm.id}`}>{t("farms.irrigation")}</Label>
                                <Select id={`irrigation-${farm.id}`} name="irrigation_source" defaultValue={farm.irrigation_source ?? ""}>
                                  <option value="">{t("common.notAvailable")}</option>
                                  <option value="rainfed">{t("farms.irrigation.rainfed")}</option>
                                  <option value="borewell">{t("farms.irrigation.borewell")}</option>
                                  <option value="canal">{t("farms.irrigation.canal")}</option>
                                  <option value="tank">{t("farms.irrigation.tank")}</option>
                                  <option value="drip">{t("farms.irrigation.drip")}</option>
                                  <option value="sprinkler">{t("farms.irrigation.sprinkler")}</option>
                                </Select>
                              </div>
                              <div className="sm:col-span-2">
                                <Label htmlFor={`notes-${farm.id}`} hint={t("common.optional")}>
                                  {t("farms.notes")}
                                </Label>
                                <TextArea id={`notes-${farm.id}`} name="notes" rows={2} defaultValue={farm.notes ?? ""} maxLength={500} />
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <SubmitButton variant="secondary">{t("common.save")}</SubmitButton>
                            </div>
                      </ActionForm>

                      <form action={deleteFarmAction} className="mt-3">
                        <input type="hidden" name="farmId" value={farm.id} />
                        <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger-600 hover:underline">
                          <Trash2 className="size-3.5" aria-hidden />
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

      <Card id="add-farm">
        <CardHeader icon={<PlusCircle className="size-5" aria-hidden />} title={t("farms.add")} subtitle={t("farms.subtitle")} />
        <CardBody>
          <ActionForm action={createFarmAction} showMessage>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="name">{t("farms.name")}</Label>
                    <TextInput id="name" name="name" required maxLength={120} placeholder={t("farms.nameHint")} />
                  </div>
                  <div>
                    <Label htmlFor="size_acres" hint={t("common.optional")}>
                      {t("farms.size")}
                    </Label>
                    <TextInput id="size_acres" name="size_acres" type="number" step="0.01" min={0} inputMode="decimal" />
                  </div>
                  <div>
                    <Label htmlFor="soil_type" hint={t("common.optional")}>
                      {t("soil.soilType")}
                    </Label>
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
                    <Label htmlFor="village">{t("farms.village")}</Label>
                    <TextInput id="village" name="village" maxLength={80} />
                  </div>
                  <div>
                    <Label htmlFor="district">{t("farms.district")}</Label>
                    <TextInput id="district" name="district" maxLength={80} />
                  </div>
                  <div>
                    <Label htmlFor="state">{t("farms.state")}</Label>
                    <TextInput id="state" name="state" defaultValue="Andhra Pradesh" maxLength={80} />
                  </div>
                  <div>
                    <Label htmlFor="pincode" hint={t("common.optional")}>
                      {t("farms.pincode")}
                    </Label>
                    <TextInput id="pincode" name="pincode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} />
                  </div>
                  <div>
                    <Label htmlFor="irrigation_source" hint={t("common.optional")}>
                      {t("farms.irrigation")}
                    </Label>
                    <Select id="irrigation_source" name="irrigation_source" defaultValue="">
                      <option value="">{t("common.notAvailable")}</option>
                      <option value="rainfed">{t("farms.irrigation.rainfed")}</option>
                      <option value="borewell">{t("farms.irrigation.borewell")}</option>
                      <option value="canal">{t("farms.irrigation.canal")}</option>
                      <option value="tank">{t("farms.irrigation.tank")}</option>
                      <option value="drip">{t("farms.irrigation.drip")}</option>
                      <option value="sprinkler">{t("farms.irrigation.sprinkler")}</option>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink-700">
                      <input type="checkbox" name="is_primary" value="on" className="size-5 rounded border-ink-300" />
                      {t("farms.setPrimary")}
                    </label>
                  </div>
                  <div>
                    <Label htmlFor="latitude" hint={t("common.optional")}>
                      {t("map.latitude")}
                    </Label>
                    <TextInput id="latitude" name="latitude" type="number" step="0.0001" inputMode="decimal" />
                  </div>
                  <div>
                    <Label htmlFor="longitude" hint={t("common.optional")}>
                      {t("map.longitude")}
                    </Label>
                    <TextInput id="longitude" name="longitude" type="number" step="0.0001" inputMode="decimal" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label htmlFor="notes" hint={t("common.optional")}>
                      {t("farms.notes")}
                    </Label>
                    <TextArea id="notes" name="notes" rows={2} maxLength={500} />
                  </div>
                </div>
                <div className="mt-3">
                  <SubmitButton dataPrimary>{t("farms.add")}</SubmitButton>
                </div>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}
