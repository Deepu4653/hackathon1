import Link from "next/link";
import { Eye, Pencil, PlusCircle, Store } from "lucide-react";
import { Badge, Callout, Card, CardBody, EmptyState, PageHeader, formatCurrency, formatDate, formatNumber } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { deleteListingAction, setListingStatusAction } from "@/app/actions/listings";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listImagesForListings, listMyListings } from "@/lib/repos/listings";

export const metadata = { title: "My listings" };

export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser("/listings/mine");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const listings = await listMyListings(user.id);
  const images = await listImagesForListings(listings.map((listing) => listing.id));
  const primaryImage = new Map<string, string>();
  for (const image of images) {
    if (!primaryImage.has(image.listing_id)) primaryImage.set(image.listing_id, image.url);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("market.myListings")}
        subtitle={t("market.myListingsSubtitle")}
        action={
          <Link
            href="/listings/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white hover:bg-field-800"
          >
            <PlusCircle className="size-4" aria-hidden />
            {t("market.create")}
          </Link>
        }
      />

      {params.saved ? <Callout tone="success" title={t("market.savedTitle")}>{t("market.savedBody")}</Callout> : null}
      {params.deleted ? <Callout tone="info" title={t("market.deletedTitle")}>{t("market.deletedBody")}</Callout> : null}

      {listings.length === 0 ? (
        <EmptyState
          icon={<Store className="size-6" aria-hidden />}
          title={t("market.noOwnListings")}
          body={t("market.noOwnListingsBody")}
          action={
            <Link
              href="/listings/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
            >
              <PlusCircle className="size-4" aria-hidden />
              {t("market.create")}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Card>
                <CardBody className="flex flex-wrap items-start gap-4">
                  <Link href={`/market/${listing.id}`} className="size-20 shrink-0 overflow-hidden rounded-xl bg-field-50">
                    {primaryImage.get(listing.id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={primaryImage.get(listing.id)} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <span className="grid size-full place-items-center text-field-400">
                        <Store className="size-6" aria-hidden />
                      </span>
                    )}
                  </Link>

                  <div className="min-w-[12rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/market/${listing.id}`} className="text-sm font-bold text-ink-900 hover:text-field-700">
                        {listing.title}
                      </Link>
                      <Badge tone={listing.status === "active" ? "green" : listing.status === "sold" ? "amber" : "neutral"}>
                        {t(`market.status.${listing.status}` as never)}
                      </Badge>
                      <Badge tone="neutral">{t(`market.kind.${listing.kind}` as never)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {listing.price_per_unit != null ? formatCurrency(listing.price_per_unit) : "—"}
                      {listing.unit ? ` / ${listing.unit}` : ""}
                      {listing.quantity != null ? ` · ${formatNumber(Number(listing.quantity), 2)} ${listing.unit ?? ""}` : ""}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-ink-400">
                      <span>{formatDate(listing.created_at, locale)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3.5" aria-hidden />
                        {listing.views_count}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/listings/${listing.id}/edit`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 text-sm font-semibold text-ink-800 hover:border-field-300"
                    >
                      <Pencil className="size-4" aria-hidden />
                      {t("common.edit")}
                    </Link>

                    <form action={setListingStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="listingId" value={listing.id} />
                      <label className="sr-only" htmlFor={`status-${listing.id}`}>
                        {t("market.statusLabel")}
                      </label>
                      <select
                        id={`status-${listing.id}`}
                        name="status"
                        defaultValue={listing.status}
                        className="min-h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm"
                      >
                        <option value="active">{t("market.status.active")}</option>
                        <option value="sold">{t("market.status.sold")}</option>
                        <option value="draft">{t("market.status.draft")}</option>
                        <option value="archived">{t("market.status.archived")}</option>
                      </select>
                      <SubmitButton variant="secondary">{t("common.update")}</SubmitButton>
                    </form>

                    <form action={deleteListingAction}>
                      <input type="hidden" name="listingId" value={listing.id} />
                      <SubmitButton variant="ghost">{t("common.delete")}</SubmitButton>
                    </form>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
