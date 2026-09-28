"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Info, Loader2, MapPin, Package, Tractor, X } from "lucide-react";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui";
import { FieldError, FormMessage, Label, Select, SubmitButton, TextArea, TextInput } from "@/components/forms";
import { useI18n } from "@/lib/i18n/provider";
import type { ActionState } from "@/lib/actions/state";
import { createListingAction, updateListingAction } from "@/app/actions/listings";
import type { Category, Listing, ListingKind, Machinery } from "@/lib/db/types";
import { MACHINE_TYPE } from "@/lib/validation/schemas";

type Mode = "create" | "edit";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGES = 6;

export function ListingForm({
  mode,
  categories,
  listing,
  machinery,
  defaults,
}: {
  mode: Mode;
  categories: Category[];
  listing?: Listing | null;
  machinery?: Machinery | null;
  defaults: { village: string; district: string; state: string; phone: string };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState | null, FormData>(
    mode === "create" ? createListingAction : updateListingAction,
    null,
  );

  const [kind, setKind] = useState<ListingKind>(listing?.kind ?? "produce");
  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const redirected = useRef(false);

  useEffect(() => {
    if (state?.ok && mode === "create" && !redirected.current) {
      redirected.current = true;
      router.push("/listings/mine?saved=1");
    }
  }, [state, mode, router]);

  useEffect(() => {
    return () => {
      for (const image of images) URL.revokeObjectURL(image.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: Array<{ file: File; preview: string }> = [];
    for (const file of Array.from(files)) {
      if (images.length + next.length >= MAX_IMAGES) {
        setImageError(t("market.maxImages"));
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setImageError(t("market.imageType"));
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setImageError(t("market.imageSize"));
        continue;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    if (next.length) {
      setImageError(null);
      setImages((current) => [...current, ...next]);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(formData: FormData) {
    formData.delete("images");
    for (const image of images) formData.append("images", image.file);
    formAction(formData);
  }

  const kindOptions: Array<{ value: ListingKind; label: string; icon: typeof Package }> = [
    { value: "produce", label: t("market.kind.produce"), icon: Package },
    { value: "input", label: t("market.kind.input"), icon: Package },
    { value: "machinery", label: t("market.kind.machinery"), icon: Tractor },
    { value: "service", label: t("market.kind.service"), icon: Info },
  ];

  const filteredCategories = categories.filter((category) => category.kind === kind);

  return (
    <form action={handleSubmit} className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <Card>
          <CardHeader title={t("market.form.basics")} subtitle={t("market.form.basicsHint")} />
          <CardBody className="space-y-4">
            <FormMessage state={state} />

            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold text-ink-700">{t("market.form.kind")}</legend>
              <div className="flex flex-wrap gap-2">
                {kindOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <label
                      key={option.value}
                      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${
                        kind === option.value
                          ? "border-field-600 bg-field-50 text-field-800"
                          : "border-ink-200 bg-white text-ink-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="kind"
                        value={option.value}
                        checked={kind === option.value}
                        onChange={() => setKind(option.value)}
                        className="sr-only"
                      />
                      <Icon className="size-4" aria-hidden />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <Label htmlFor="title">{t("market.form.title")}</Label>
              <TextInput id="title" name="title" required maxLength={140} defaultValue={listing?.title ?? ""} placeholder={t("market.form.titleHint")} />
              <FieldError>{state?.fieldErrors?.title}</FieldError>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="category_id" hint={t("common.optional")}>
                  {t("market.category")}
                </Label>
                <Select id="category_id" name="category_id" defaultValue={listing?.category_id ?? ""}>
                  <option value="">{t("market.allCategories")}</option>
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name_en}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="crop_name" hint={t("common.optional")}>
                  {t("crops.name")}
                </Label>
                <TextInput id="crop_name" name="crop_name" maxLength={80} defaultValue={listing?.crop_name ?? ""} />
              </div>
            </div>

            <div>
              <Label htmlFor="description" hint={t("common.optional")}>
                {t("market.form.description")}
              </Label>
              <TextArea
                id="description"
                name="description"
                rows={4}
                maxLength={4000}
                defaultValue={listing?.description ?? ""}
                placeholder={t("market.form.descriptionHint")}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<Package className="size-5" aria-hidden />} title={t("market.form.pricing")} subtitle={t("market.form.pricingHint")} />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="quantity" hint={t("common.optional")}>
                {t("market.quantity")}
              </Label>
              <TextInput
                id="quantity"
                name="quantity"
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                defaultValue={listing?.quantity != null ? Number(listing.quantity) : ""}
              />
              <FieldError>{state?.fieldErrors?.quantity}</FieldError>
            </div>
            <div>
              <Label htmlFor="unit" hint={t("common.optional")}>
                {t("market.unit")}
              </Label>
              <TextInput id="unit" name="unit" maxLength={20} defaultValue={listing?.unit ?? ""} placeholder={t("market.unitHint")} />
            </div>
            <div>
              <Label htmlFor="price_per_unit" hint={t("common.optional")}>
                {t("market.price")}
              </Label>
              <TextInput
                id="price_per_unit"
                name="price_per_unit"
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                defaultValue={listing?.price_per_unit != null ? Number(listing.price_per_unit) : ""}
              />
              <FieldError>{state?.fieldErrors?.price_per_unit}</FieldError>
            </div>
            <div>
              <Label htmlFor="min_order_quantity" hint={t("common.optional")}>
                {t("market.minOrder")}
              </Label>
              <TextInput
                id="min_order_quantity"
                name="min_order_quantity"
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                defaultValue={listing?.min_order_quantity != null ? Number(listing.min_order_quantity) : ""}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink-700">
                <input
                  type="checkbox"
                  name="is_negotiable"
                  value="on"
                  defaultChecked={listing?.is_negotiable ?? false}
                  className="size-5 rounded border-ink-300"
                />
                {t("market.negotiable")}
              </label>
            </div>
          </CardBody>
        </Card>

        {kind === "machinery" ? (
          <Card>
            <CardHeader icon={<Tractor className="size-5" aria-hidden />} title={t("market.machinery.title")} subtitle={t("market.machinery.subtitle")} />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="machine_type">{t("market.machinery.type")}</Label>
                <Select id="machine_type" name="machine_type" defaultValue={machinery?.machine_type ?? "tractor"}>
                  {MACHINE_TYPE.options.map((option) => (
                    <option key={option} value={option}>
                      {t(`market.machinery.type.${option}` as never)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="brand" hint={t("common.optional")}>
                  {t("market.machinery.brand")}
                </Label>
                <TextInput id="brand" name="brand" maxLength={60} defaultValue={machinery?.brand ?? ""} />
              </div>
              <div>
                <Label htmlFor="model" hint={t("common.optional")}>
                  {t("market.machinery.model")}
                </Label>
                <TextInput id="model" name="model" maxLength={60} defaultValue={machinery?.model ?? ""} />
              </div>
              <div>
                <Label htmlFor="manufacture_year" hint={t("common.optional")}>
                  {t("market.machinery.year")}
                </Label>
                <TextInput
                  id="manufacture_year"
                  name="manufacture_year"
                  type="number"
                  min={1950}
                  max={2100}
                  inputMode="numeric"
                  defaultValue={machinery?.manufacture_year ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="horsepower" hint={t("common.optional")}>
                  {t("market.machinery.horsepower")}
                </Label>
                <TextInput
                  id="horsepower"
                  name="horsepower"
                  type="number"
                  step="0.1"
                  min={0}
                  inputMode="decimal"
                  defaultValue={machinery?.horsepower != null ? Number(machinery.horsepower) : ""}
                />
              </div>
              <div>
                <Label htmlFor="service_radius_km" hint={t("common.optional")}>
                  {t("market.machinery.radius")}
                </Label>
                <TextInput
                  id="service_radius_km"
                  name="service_radius_km"
                  type="number"
                  step="1"
                  min={0}
                  inputMode="numeric"
                  defaultValue={machinery?.service_radius_km != null ? Number(machinery.service_radius_km) : ""}
                />
              </div>
              <div>
                <Label htmlFor="rental_price_per_day" hint={t("common.optional")}>
                  {t("market.machinery.pricePerDay")}
                </Label>
                <TextInput
                  id="rental_price_per_day"
                  name="rental_price_per_day"
                  type="number"
                  step="1"
                  min={0}
                  inputMode="numeric"
                  defaultValue={machinery?.rental_price_per_day != null ? Number(machinery.rental_price_per_day) : ""}
                />
              </div>
              <div>
                <Label htmlFor="rental_price_per_hour" hint={t("common.optional")}>
                  {t("market.machinery.pricePerHour")}
                </Label>
                <TextInput
                  id="rental_price_per_hour"
                  name="rental_price_per_hour"
                  type="number"
                  step="1"
                  min={0}
                  inputMode="numeric"
                  defaultValue={machinery?.rental_price_per_hour != null ? Number(machinery.rental_price_per_hour) : ""}
                />
              </div>
              <div>
                <Label htmlFor="rental_price_per_acre" hint={t("common.optional")}>
                  {t("market.machinery.pricePerAcre")}
                </Label>
                <TextInput
                  id="rental_price_per_acre"
                  name="rental_price_per_acre"
                  type="number"
                  step="1"
                  min={0}
                  inputMode="numeric"
                  defaultValue={machinery?.rental_price_per_acre != null ? Number(machinery.rental_price_per_acre) : ""}
                />
              </div>
              <div>
                <Label htmlFor="machine_status">{t("market.machinery.status")}</Label>
                <Select id="machine_status" name="machine_status" defaultValue={machinery?.status ?? "available"}>
                  <option value="available">{t("market.machinery.status.available")}</option>
                  <option value="booked">{t("market.machinery.status.booked")}</option>
                  <option value="maintenance">{t("market.machinery.status.maintenance")}</option>
                  <option value="inactive">{t("market.machinery.status.inactive")}</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink-700">
                  <input
                    type="checkbox"
                    name="with_operator"
                    value="on"
                    defaultChecked={machinery?.with_operator ?? false}
                    className="size-5 rounded border-ink-300"
                  />
                  {t("market.machinery.withOperator")}
                </label>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader icon={<ImagePlus className="size-5" aria-hidden />} title={t("market.form.photos")} subtitle={t("market.form.photosHint")} />
          <CardBody>
            <input
              ref={fileRef}
              id="images"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => addFiles(event.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {images.map((image, index) => (
                <div key={image.preview} className="relative">
                  <Image
                    src={image.preview}
                    alt=""
                    width={96}
                    height={96}
                    unoptimized
                    className="size-24 rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(image.preview);
                      setImages((current) => current.filter((_, position) => position !== index));
                    }}
                    aria-label={t("common.delete")}
                    className="absolute -right-1.5 -top-1.5 grid size-7 place-items-center rounded-full border border-ink-200 bg-white text-ink-600 shadow"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid size-24 place-items-center rounded-xl border-2 border-dashed border-ink-200 text-ink-400 hover:border-field-400 hover:text-field-600"
                >
                  <ImagePlus className="size-6" aria-hidden />
                </button>
              ) : null}
            </div>
            <FieldError>{imageError}</FieldError>
            <p className="mt-2 text-xs leading-relaxed text-ink-500">{t("market.form.photoRules")}</p>
          </CardBody>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardHeader icon={<MapPin className="size-5" aria-hidden />} title={t("market.location")} subtitle={t("market.form.locationHint")} />
          <CardBody className="grid gap-3">
            <div>
              <Label htmlFor="village">{t("farms.village")}</Label>
              <TextInput id="village" name="village" maxLength={80} defaultValue={listing?.village ?? defaults.village} />
            </div>
            <div>
              <Label htmlFor="district">{t("farms.district")}</Label>
              <TextInput id="district" name="district" maxLength={80} defaultValue={listing?.district ?? defaults.district} />
            </div>
            <div>
              <Label htmlFor="state">{t("farms.state")}</Label>
              <TextInput id="state" name="state" maxLength={80} defaultValue={listing?.state ?? defaults.state} />
            </div>
            <div>
              <Label htmlFor="pincode" hint={t("common.optional")}>
                {t("farms.pincode")}
              </Label>
              <TextInput id="pincode" name="pincode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} defaultValue={listing?.pincode ?? ""} />
              <FieldError>{state?.fieldErrors?.pincode}</FieldError>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="latitude" hint={t("common.optional")}>
                  {t("map.latitude")}
                </Label>
                <TextInput
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="0.0001"
                  inputMode="decimal"
                  defaultValue={listing?.latitude ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="longitude" hint={t("common.optional")}>
                  {t("map.longitude")}
                </Label>
                <TextInput
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="0.0001"
                  inputMode="decimal"
                  defaultValue={listing?.longitude ?? ""}
                />
              </div>
            </div>
            <p className="text-xs leading-relaxed text-ink-500">{t("market.form.mapHint")}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t("market.form.availability")} />
          <CardBody className="grid gap-3">
            <div>
              <Label htmlFor="harvest_date" hint={t("common.optional")}>
                {t("market.harvestDate")}
              </Label>
              <TextInput id="harvest_date" name="harvest_date" type="date" defaultValue={listing?.harvest_date ?? ""} />
            </div>
            <div>
              <Label htmlFor="available_from" hint={t("common.optional")}>
                {t("market.availableFrom")}
              </Label>
              <TextInput id="available_from" name="available_from" type="date" defaultValue={listing?.available_from ?? ""} />
            </div>
            <div>
              <Label htmlFor="available_until" hint={t("common.optional")}>
                {t("market.availableUntil")}
              </Label>
              <TextInput id="available_until" name="available_until" type="date" defaultValue={listing?.available_until ?? ""} />
            </div>
            <div>
              <Label htmlFor="contact_phone" hint={t("market.form.phoneHint")}>
                {t("auth.phone")}
              </Label>
              <TextInput id="contact_phone" name="contact_phone" inputMode="tel" maxLength={15} defaultValue={listing?.contact_phone ?? defaults.phone} />
              <FieldError>{state?.fieldErrors?.contact_phone}</FieldError>
            </div>
            {mode === "edit" ? (
              <div>
                <Label htmlFor="status">{t("market.statusLabel")}</Label>
                <Select id="status" name="status" defaultValue={listing?.status ?? "active"}>
                  <option value="draft">{t("market.status.draft")}</option>
                  <option value="active">{t("market.status.active")}</option>
                  <option value="sold">{t("market.status.sold")}</option>
                  <option value="archived">{t("market.status.archived")}</option>
                </Select>
              </div>
            ) : (
              <input type="hidden" name="status" value="active" />
            )}
          </CardBody>
        </Card>

        <Callout tone="info" title={t("market.form.rulesTitle")}>
          {t("market.form.rulesBody")}
        </Callout>

        <SubmitButton dataPrimary disabled={pending} className="w-full" pendingLabel={t("common.saving")}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {mode === "create" ? t("market.publish") : t("common.save")}
        </SubmitButton>
      </aside>
    </form>
  );
}
