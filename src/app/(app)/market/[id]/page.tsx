import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Flag,
  Heart,
  MapPin,
  MessageSquare,
  Phone,
  Ruler,
  ShieldCheck,
  Tractor,
} from "lucide-react";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  DataRow,
  formatCurrency,
  formatDate,
  formatNumber,
} from "@/components/ui";
import { ActionForm, Label, Select, SubmitButton, TextArea } from "@/components/forms";
import { getSessionUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { getListingDetail, incrementListingViews } from "@/lib/repos/listings";
import { toggleFavoriteAction, reportListingAction } from "@/app/actions/listings";
import { startConversationAction } from "@/app/actions/messaging";
import { MarketMap } from "@/components/map/market-map";

export const metadata = { title: "Listing" };

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const { t, locale } = await getTranslatorForRequest(user?.profile.simple_mode);

  const listing = await getListingDetail(id, user?.id ?? null);
  if (!listing) notFound();

  // Only real, server-side view — never incremented for the owner's own visits.
  if (listing.seller_id !== user?.id) {
    await incrementListingViews(listing.id);
  }

  const isOwner = listing.seller_id === user?.id;
  const machine = listing.machinery;

  return (
    <div className="space-y-4">
      <Link href="/market" className="inline-flex items-center gap-1.5 text-sm font-semibold text-field-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        {t("market.title")}
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="aspect-[16/10] w-full bg-field-50">
              {listing.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.images[0].url} alt={listing.title} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-field-400">
                  {listing.kind === "machinery" ? <Tractor className="size-12" aria-hidden /> : <Ruler className="size-12" aria-hidden />}
                </div>
              )}
            </div>
            {listing.images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto p-3">
                {listing.images.slice(1).map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={image.id}
                    src={image.url}
                    alt=""
                    className="size-20 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : null}
            <CardBody>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">{t(`market.kind.${listing.kind}` as never)}</Badge>
                <Badge tone={listing.status === "active" ? "green" : "neutral"}>
                  {t(`market.status.${listing.status}` as never)}
                </Badge>
                {listing.category ? <Badge tone="neutral">{listing.category.name_en}</Badge> : null}
                {listing.is_negotiable ? <Badge tone="amber">{t("market.negotiable")}</Badge> : null}
              </div>
              <h1 className="mt-3 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{listing.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden />
                  {[listing.village, listing.district, listing.state].filter(Boolean).join(", ") || t("common.notAvailable")}
                </span>
                <span>
                  {t("market.postedOn")} {formatDate(listing.created_at, locale)}
                </span>
                <span>
                  {listing.views_count} {t("market.views")}
                </span>
              </p>
              {listing.description ? (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-700">{listing.description}</p>
              ) : null}
            </CardBody>
          </Card>

          {machine ? (
            <Card>
              <CardHeader icon={<Tractor className="size-5" aria-hidden />} title={t("market.machinery.title")} />
              <CardBody>
                <dl>
                  <DataRow label={t("market.machinery.type")} value={machine.machine_type.replace(/_/g, " ")} />
                  {machine.brand ? <DataRow label={t("market.machinery.brand")} value={machine.brand} /> : null}
                  {machine.model ? <DataRow label={t("market.machinery.model")} value={machine.model} /> : null}
                  {machine.manufacture_year ? (
                    <DataRow label={t("market.machinery.year")} value={machine.manufacture_year} />
                  ) : null}
                  {machine.horsepower ? (
                    <DataRow label={t("market.machinery.horsepower")} value={`${formatNumber(machine.horsepower, 1)} HP`} />
                  ) : null}
                  {machine.rental_price_per_day ? (
                    <DataRow label={t("market.machinery.pricePerDay")} value={formatCurrency(machine.rental_price_per_day)} />
                  ) : null}
                  {machine.rental_price_per_hour ? (
                    <DataRow label={t("market.machinery.pricePerHour")} value={formatCurrency(machine.rental_price_per_hour)} />
                  ) : null}
                  {machine.rental_price_per_acre ? (
                    <DataRow label={t("market.machinery.pricePerAcre")} value={formatCurrency(machine.rental_price_per_acre)} />
                  ) : null}
                  <DataRow
                    label={t("market.machinery.withOperator")}
                    value={machine.with_operator ? t("common.yes") : t("common.no")}
                  />
                  {machine.service_radius_km ? (
                    <DataRow label={t("market.machinery.radius")} value={`${formatNumber(machine.service_radius_km, 0)} km`} />
                  ) : null}
                  <DataRow
                    label={t("market.machinery.status")}
                    value={t(`market.machinery.status.${machine.status}` as never)}
                  />
                </dl>
              </CardBody>
            </Card>
          ) : null}

          {listing.latitude !== null && listing.longitude !== null ? (
            <Card>
              <CardHeader icon={<MapPin className="size-5" aria-hidden />} title={t("market.location")} />
              <CardBody className="p-0">
                <div className="h-64 overflow-hidden rounded-b-[var(--radius-card)]">
                  <MarketMap
                    markers={[
                      {
                        id: listing.id,
                        latitude: listing.latitude,
                        longitude: listing.longitude,
                        title: listing.title,
                        kind: listing.kind,
                      },
                    ]}
                    center={{ latitude: listing.latitude, longitude: listing.longitude }}
                    zoom={12}
                  />
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <p className="text-2xl font-bold text-ink-900">
                {listing.price_per_unit !== null ? formatCurrency(listing.price_per_unit) : "—"}
                {listing.unit ? <span className="ml-1 text-sm font-medium text-ink-500">/ {listing.unit}</span> : null}
              </p>
              {listing.quantity !== null ? (
                <p className="text-sm text-ink-600">
                  {t("market.quantity")}: {formatNumber(listing.quantity, 2)} {listing.unit ?? ""}
                </p>
              ) : null}
              {listing.min_order_quantity ? (
                <p className="text-sm text-ink-600">
                  {t("market.minOrder")}: {formatNumber(listing.min_order_quantity, 2)} {listing.unit ?? ""}
                </p>
              ) : null}
              {listing.harvest_date ? (
                <p className="text-sm text-ink-600">
                  {t("market.harvestDate")}: {formatDate(listing.harvest_date, locale)}
                </p>
              ) : null}
              {listing.available_from || listing.available_until ? (
                <p className="text-sm text-ink-600">
                  {t("market.availableFrom")}: {listing.available_from ? formatDate(listing.available_from, locale) : "—"}
                  {" · "}
                  {t("market.availableUntil")}: {listing.available_until ? formatDate(listing.available_until, locale) : "—"}
                </p>
              ) : null}

              {listing.seller ? (
                <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                    <ShieldCheck className="size-4 text-field-600" aria-hidden />
                    {listing.seller.full_name || t("market.seller")}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {[listing.seller.village, listing.seller.district].filter(Boolean).join(", ")}
                    {" · "}
                    {t(`auth.role.${listing.seller.role}` as never)}
                  </p>
                  {listing.contact_phone && (user || isOwner) ? (
                    <a
                      href={`tel:${listing.contact_phone}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-field-700 hover:underline"
                    >
                      <Phone className="size-3.5" aria-hidden />
                      {listing.contact_phone}
                    </a>
                  ) : null}
                </div>
              ) : null}

              {isOwner ? (
                <div className="space-y-2">
                  <p className="rounded-xl bg-field-50 px-3 py-2 text-xs font-medium text-field-800">
                    {t("market.myListings")}
                  </p>
                  <Link
                    href={`/listings/${listing.id}/edit`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-ink-200 bg-white text-sm font-semibold text-ink-800"
                  >
                    {t("common.edit")}
                  </Link>
                </div>
              ) : user ? (
                <ActionForm action={startConversationAction} className="space-y-2" showMessage>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <Label htmlFor="message">{t("market.contactSeller")}</Label>
                      <TextArea
                        id="message"
                        name="message"
                        rows={3}
                        maxLength={1000}
                        placeholder={t("messages.placeholder")}
                        defaultValue={`${t("market.contactSeller")}: ${listing.title}`}
                      />
                      <SubmitButton className="w-full" dataPrimary>
                        <MessageSquare className="size-4" aria-hidden />
                        {t("market.contactSeller")}
                      </SubmitButton>
                </ActionForm>
              ) : (
                <Link
                  href={`/login?next=/market/${listing.id}`}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-field-700 text-sm font-semibold text-white"
                >
                  {t("market.signInToSell")}
                </Link>
              )}

              {user ? (
                <form action={toggleFavoriteAction}>
                  <input type="hidden" name="listingId" value={listing.id} />
                  <SubmitButton variant="secondary" className="w-full">
                    <Heart className={`size-4 ${listing.isFavorite ? "fill-danger-500 text-danger-500" : ""}`} aria-hidden />
                    {listing.isFavorite ? t("market.unsave") : t("market.saveFavorite")}
                  </SubmitButton>
                </form>
              ) : null}
            </CardBody>
          </Card>

          {user && !isOwner ? (
            <Card>
              <CardHeader icon={<Flag className="size-5" aria-hidden />} title={t("market.report")} />
              <CardBody>
                <ActionForm action={reportListingAction} className="space-y-3" showMessage>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <div>
                        <Label htmlFor="reason">{t("market.reportReason")}</Label>
                        <Select id="reason" name="reason" defaultValue="spam">
                          <option value="spam">{t("market.reportReason.spam")}</option>
                          <option value="fake_listing">{t("market.reportReason.fake_listing")}</option>
                          <option value="wrong_price">{t("market.reportReason.wrong_price")}</option>
                          <option value="abusive">{t("market.reportReason.abusive")}</option>
                          <option value="prohibited_item">{t("market.reportReason.prohibited_item")}</option>
                          <option value="other">{t("market.reportReason.other")}</option>
                        </Select>
                      </div>
                      <TextArea id="details" name="details" rows={2} placeholder={t("market.reportDetails")} maxLength={800} />
                      <SubmitButton variant="ghost">{t("market.reportSubmit")}</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          <Callout tone="info" title={t("prices.sourceNote")} />
        </aside>
      </div>
    </div>
  );
}
