import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card, CardBody, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";

const ADMIN_LINKS = [
  { href: "/admin", key: "admin.nav.overview" },
  { href: "/admin/users", key: "admin.nav.users" },
  { href: "/admin/listings", key: "admin.nav.listings" },
  { href: "/admin/reports", key: "admin.nav.reports" },
  { href: "/admin/categories", key: "admin.nav.categories" },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const { t } = await getTranslatorForRequest(admin.profile.simple_mode);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("admin.title")}
        subtitle={t("admin.subtitle")}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold text-white">
            <ShieldCheck className="size-3.5" aria-hidden />
            {t("admin.badge")}
          </span>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap gap-2">
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-10 items-center rounded-xl border border-ink-200 bg-white px-3.5 text-sm font-semibold text-ink-700 hover:border-field-300 hover:bg-field-50"
            >
              {t(link.key)}
            </Link>
          ))}
        </CardBody>
      </Card>

      {children}
    </div>
  );
}
