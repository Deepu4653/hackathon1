import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Callout, PageHeader } from "@/components/ui";
import { ListingForm } from "@/components/market/listing-form";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listCategories } from "@/lib/repos/categories";
import { getPrimaryFarm } from "@/lib/repos/farms";

export const metadata = { title: "New listing" };

export default async function NewListingPage() {
  const user = await requireUser("/listings/new");
  const { t } = await getTranslatorForRequest(user.profile.simple_mode);
  const [categories, farm] = await Promise.all([listCategories(), getPrimaryFarm(user.id)]);

  return (
    <div className="space-y-4">
      <Link href="/listings/mine" className="inline-flex items-center gap-1.5 text-sm font-semibold text-field-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        {t("market.myListings")}
      </Link>

      <PageHeader title={t("market.create")} subtitle={t("market.form.createHint")} />

      <Callout tone="info" title={t("market.form.rulesTitle")}>
        {t("market.form.rulesBody")}
      </Callout>

      <ListingForm
        mode="create"
        categories={categories}
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
