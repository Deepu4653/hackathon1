import Link from "next/link";
import { Heart } from "lucide-react";
import { Card, CardBody, EmptyState, PageHeader, formatCurrency } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { toggleFavoriteAction } from "@/app/actions/listings";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listFavorites } from "@/lib/repos/listings";

export const metadata = { title: "Saved listings" };

export default async function FavoritesPage() {
  const user = await requireUser("/favorites");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);
  const favorites = await listFavorites(user.id);

  return (
    <div className="space-y-5">
      <PageHeader title={t("favorites.title")} subtitle={t("favorites.subtitle")} />

      {favorites.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" aria-hidden />}
          title={t("favorites.empty")}
          body={t("favorites.emptyBody")}
          action={
            <Link
              href="/market"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
            >
              {t("nav.market")}
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {favorites.map((listing) => (
            <li key={listing.id}>
              <Card>
                <CardBody className="flex gap-3.5">
                  <Link href={`/market/${listing.id}`} className="size-24 shrink-0 overflow-hidden rounded-xl bg-field-50">
                    {listing.primary_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.primary_image} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <span className="grid size-full place-items-center text-field-400">
                        <Heart className="size-6" aria-hidden />
                      </span>
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/market/${listing.id}`} className="truncate text-sm font-semibold text-ink-900 hover:text-field-700">
                      {listing.title}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {[listing.village, listing.district].filter(Boolean).join(", ") || t("common.notAvailable")}
                    </p>
                    <p className="mt-1 text-base font-bold text-ink-900">
                      {listing.price_per_unit != null ? formatCurrency(listing.price_per_unit) : "—"}
                      {listing.unit ? <span className="ml-1 text-xs font-normal text-ink-500">/ {listing.unit}</span> : null}
                    </p>
                    <p className="mt-auto text-xs text-ink-400">
                      {t("favorites.savedOn")} {new Date(listing.saved_at).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                    </p>
                    <form action={toggleFavoriteAction} className="mt-2">
                      <input type="hidden" name="listingId" value={listing.id} />
                      <SubmitButton variant="ghost">{t("favorites.remove")}</SubmitButton>
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
