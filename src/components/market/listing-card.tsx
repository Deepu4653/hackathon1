import Link from "next/link";
import { Heart, MapPin, Store, Tractor } from "lucide-react";
import { Badge, Card, formatCurrency, formatNumber } from "@/components/ui";
import { toggleFavoriteAction } from "@/app/actions/listings";
import type { Translator } from "@/lib/i18n";
import type { Category, Listing, ListingKind } from "@/lib/db/types";

export interface ListingCardRow extends Listing {
  primary_image?: string | null;
  category?: Category | null;
  machine_type?: string | null;
}

const KIND_TONE: Record<ListingKind, "green" | "amber" | "blue" | "neutral"> = {
  produce: "green",
  input: "blue",
  machinery: "amber",
  service: "neutral",
};

export function ListingCard({
  listing,
  t,
  locale,
  isFavorite = false,
  showFavorite = true,
  ownerView = false,
}: {
  listing: ListingCardRow;
  t: Translator;
  locale: string;
  isFavorite?: boolean;
  showFavorite?: boolean;
  ownerView?: boolean;
}) {
  const kindLabel = t(`market.kind.${listing.kind}` as never);
  const statusLabel = t(`market.status.${listing.status}` as never);

  return (
    <Card as="li" className="flex h-full flex-col overflow-hidden">
      <div className="relative">
        <Link href={`/market/${listing.id}`} className="block aspect-[4/3] w-full overflow-hidden bg-field-50">
          {listing.primary_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.primary_image}
              alt={listing.title}
              loading="lazy"
              className="size-full object-cover transition duration-300 hover:scale-[1.03]"
            />
          ) : (
            <span className="grid size-full place-items-center text-field-400">
              {listing.kind === "machinery" ? <Tractor className="size-10" aria-hidden /> : <Store className="size-10" aria-hidden />}
            </span>
          )}
        </Link>
        <div className="absolute left-2 top-2 flex gap-1.5">
          <Badge tone={KIND_TONE[listing.kind]}>{kindLabel}</Badge>
          {listing.is_featured ? <Badge tone="amber">★</Badge> : null}
          {ownerView ? <Badge tone={listing.status === "active" ? "green" : "neutral"}>{statusLabel}</Badge> : null}
        </div>
        {showFavorite ? (
          <form action={toggleFavoriteAction} className="absolute right-2 top-2">
            <input type="hidden" name="listingId" value={listing.id} />
            <button
              type="submit"
              aria-label={isFavorite ? t("market.unsave") : t("market.saveFavorite")}
              className={`grid size-10 place-items-center rounded-full border shadow-sm transition ${
                isFavorite ? "border-danger-100 bg-danger-50 text-danger-500" : "border-ink-200 bg-white text-ink-400 hover:text-danger-500"
              }`}
            >
              <Heart className={`size-4 ${isFavorite ? "fill-current" : ""}`} aria-hidden />
            </button>
          </form>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <Link href={`/market/${listing.id}`} className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900 hover:text-field-700">
            {listing.title}
          </h3>
        </Link>

        <p className="flex items-center gap-1.5 text-xs text-ink-500">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {[listing.village, listing.district].filter(Boolean).join(", ") || t("common.notAvailable")}
          </span>
        </p>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <p className="text-base font-bold text-ink-900">
              {listing.price_per_unit !== null ? formatCurrency(listing.price_per_unit) : "—"}
            </p>
            <p className="text-[0.7rem] text-ink-500">
              {listing.unit ? `/ ${listing.unit}` : ""} {listing.is_negotiable ? `· ${t("market.negotiable")}` : ""}
            </p>
          </div>
          {listing.quantity !== null ? (
            <p className="text-right text-xs text-ink-500">
              {formatNumber(listing.quantity, 1)}
              <span className="block text-[0.7rem]">{listing.unit ?? ""}</span>
            </p>
          ) : null}
        </div>

        <p className="text-[0.7rem] text-ink-400">
          {new Date(listing.created_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
    </Card>
  );
}
