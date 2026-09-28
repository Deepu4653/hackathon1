import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Eye, Trash2 } from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader, PageHeader, formatDate } from "@/components/ui";
import { ListingForm } from "@/components/market/listing-form";
import { deleteListingImageAction } from "@/app/actions/listings";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listCategories } from "@/lib/repos/categories";
import { getMyListing, listImagesForListings } from "@/lib/repos/listings";
import { getPrimaryFarm } from "@/lib/repos/farms";
import { getDataClient } from "@/lib/db";
import type { Machinery } from "@/lib/db/types";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/listings/${id}/edit`);
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);

  const listing = await getMyListing(user.id, id);
  if (!listing) notFound();
  if (listing.status === "removed") redirect("/listings/mine");

  const db = await getDataClient();
  const [categories, images, machineryRow, farm] = await Promise.all([
    listCategories(),
    listImagesForListings([listing.id]),
    db.from<Machinery>("machinery").select("*").eq("listing_id", listing.id).maybeSingle(),
    getPrimaryFarm(user.id),
  ]);

  const machinery = (machineryRow.data as Machinery) ?? null;

  return (
    <div className="space-y-4">
      <Link href="/listings/mine" className="inline-flex items-center gap-1.5 text-sm font-semibold text-field-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        {t("market.myListings")}
      </Link>

      <PageHeader
        title={t("market.editListing")}
        subtitle={listing.title}
        badge={
          <div className="flex items-center gap-2">
            <Badge tone={listing.status === "active" ? "green" : "neutral"}>{t(`market.status.${listing.status}` as never)}</Badge>
            <Badge tone="neutral" icon={<Eye className="size-3.5" aria-hidden />}>
              {listing.views_count} {t("market.views")}
            </Badge>
          </div>
        }
      />

      {images.length > 0 ? (
        <Card>
          <CardHeader title={t("market.form.photos")} subtitle={t("market.form.existingPhotos")} />
          <CardBody>
            <ul className="flex flex-wrap gap-3">
              {images.map((image) => (
                <li key={image.id} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt="" className="size-28 rounded-xl object-cover" loading="lazy" />
                  <form action={deleteListingImageAction} className="absolute -right-1.5 -top-1.5">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="storagePath" value={image.storage_path ?? ""} />
                    <button
                      type="submit"
                      aria-label={t("common.delete")}
                      className="grid size-7 place-items-center rounded-full border border-ink-200 bg-white text-danger-600 shadow"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </form>
                  <p className="mt-1 text-[0.65rem] text-ink-400">
                    {formatDate(image.created_at, locale)}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Callout tone="info" title={t("market.form.editHint")}>
        {t("market.form.rulesBody")}
      </Callout>

      <ListingForm
        mode="edit"
        categories={categories}
        listing={listing}
        machinery={machinery}
        defaults={{
          village: farm?.village ?? user.profile.village ?? "",
          district: farm?.district ?? user.profile.district ?? "",
          state: farm?.state ?? user.profile.state ?? "Andhra Pradesh",
          phone: user.profile.phone ?? "",
        }}
      />
    </div>
  );
}
