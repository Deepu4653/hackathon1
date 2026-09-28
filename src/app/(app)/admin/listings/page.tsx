import Link from "next/link";
import { Package, Star } from "lucide-react";
import { Badge, Card, CardBody, EmptyState, formatCurrency, formatDate } from "@/components/ui";
import { ActionForm, Select, SubmitButton } from "@/components/forms";
import { setListingFeaturedAction, setListingStatusAdminAction } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listAllListings } from "@/lib/repos/admin";

export const metadata = { title: "Admin listings" };

const STATUS_FILTERS = ["all", "active", "draft", "sold", "archived", "removed"] as const;

export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin();
  const { t, locale } = await getTranslatorForRequest(admin.profile.simple_mode);

  const status = (STATUS_FILTERS as readonly string[]).includes(params.status ?? "")
    ? (params.status as (typeof STATUS_FILTERS)[number])
    : "all";
  const listings = await listAllListings(status === "all" ? undefined : (status as never));

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((value) => (
            <Link
              key={value}
              href={value === "all" ? "/admin/listings" : `/admin/listings?status=${value}`}
              className={`inline-flex min-h-10 items-center rounded-xl border px-3.5 text-sm font-semibold ${
                status === value ? "border-field-600 bg-field-700 text-white" : "border-ink-200 bg-white text-ink-700"
              }`}
            >
              {value === "all" ? t("admin.all") : t(`market.status.${value}` as never)}
            </Link>
          ))}
        </CardBody>
      </Card>

      {listings.length === 0 ? (
        <EmptyState icon={<Package className="size-6" aria-hidden />} title={t("admin.noListings")} />
      ) : (
        <ul className="space-y-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Card>
                <CardBody className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[14rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/market/${listing.id}`} className="text-sm font-bold text-ink-900 hover:text-field-700">
                        {listing.title}
                      </Link>
                      <Badge tone={listing.status === "active" ? "green" : listing.status === "removed" ? "red" : "neutral"}>
                        {t(`market.status.${listing.status}` as never)}
                      </Badge>
                      <Badge tone="neutral">{t(`market.kind.${listing.kind}` as never)}</Badge>
                      {listing.is_featured ? (
                        <Badge tone="amber" icon={<Star className="size-3.5" aria-hidden />}>
                          {t("admin.featured")}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {listing.price_per_unit != null ? formatCurrency(listing.price_per_unit) : "—"}
                      {listing.unit ? ` / ${listing.unit}` : ""} · {[listing.village, listing.district].filter(Boolean).join(", ")}
                    </p>
                    <p className="mt-1 text-xs text-ink-400">
                      {t("admin.seller")}: {listing.seller_id.slice(0, 8)} · {formatDate(listing.created_at, locale)} ·{" "}
                      {listing.views_count} {t("market.views")}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-end gap-2">
                    <ActionForm
                      action={setListingStatusAdminAction}
                      showMessage
                      messageClassName="basis-full"
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="listingId" value={listing.id} />
                      <div className="min-w-[10rem]">
                        <label htmlFor={`status-${listing.id}`} className="mb-1 block text-xs font-semibold text-ink-600">
                          {t("market.statusLabel")}
                        </label>
                        <Select id={`status-${listing.id}`} name="status" defaultValue={listing.status}>
                          <option value="active">{t("market.status.active")}</option>
                          <option value="draft">{t("market.status.draft")}</option>
                          <option value="sold">{t("market.status.sold")}</option>
                          <option value="archived">{t("market.status.archived")}</option>
                          <option value="removed">{t("market.status.removed")}</option>
                        </Select>
                      </div>
                      <SubmitButton variant="secondary">{t("common.update")}</SubmitButton>
                    </ActionForm>

                    <ActionForm action={setListingFeaturedAction} showMessage messageClassName="mt-1 basis-full">
                      <input type="hidden" name="listingId" value={listing.id} />
                      <input type="hidden" name="featured" value={listing.is_featured ? "false" : "true"} />
                      <SubmitButton variant="ghost">
                        <Star className="size-4" aria-hidden />
                        {listing.is_featured ? t("admin.unfeature") : t("admin.feature")}
                      </SubmitButton>
                    </ActionForm>
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
