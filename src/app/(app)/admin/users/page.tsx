import { Search, ShieldAlert, UserCog } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, EmptyState, formatDate } from "@/components/ui";
import { ActionForm, Select, SubmitButton } from "@/components/forms";
import { setUserBlockedAction, setUserRoleAction } from "@/app/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { listUsersForAdmin } from "@/lib/repos/admin";
import { USER_ROLES } from "@/lib/db/types";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("admin.nav.users");

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const admin = await requireAdmin();
  const { t, locale } = await getTranslatorForRequest(admin.profile.simple_mode);
  const users = await listUsersForAdmin(params.q);

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <form method="get" className="flex flex-wrap gap-2">
            <label className="min-w-[16rem] flex-1">
              <span className="sr-only">{t("admin.searchUsers")}</span>
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder={t("admin.searchUsers")}
                className="min-h-[var(--tap-min)] w-full rounded-xl border border-ink-200 px-3.5"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-[var(--tap-min)] items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
            >
              <Search className="size-4" aria-hidden />
              {t("common.search")}
            </button>
          </form>
        </CardBody>
      </Card>

      {users.length === 0 ? (
        <EmptyState icon={<UserCog className="size-6" aria-hidden />} title={t("admin.noUsers")} />
      ) : (
        <ul className="space-y-3">
          {users.map((user) => (
            <li key={user.id}>
              <Card>
                <CardHeader
                  icon={<UserCog className="size-5" aria-hidden />}
                  title={user.full_name || user.email || user.id.slice(0, 8)}
                  subtitle={`${user.email ?? "—"} · ${[user.village, user.district].filter(Boolean).join(", ") || t("common.notAvailable")}`}
                  action={
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={user.role === "admin" ? "green" : "neutral"}>{t(`auth.role.${user.role}` as never)}</Badge>
                      {user.is_blocked ? (
                        <Badge tone="red" icon={<ShieldAlert className="size-3.5" aria-hidden />}>
                          {t("admin.blocked")}
                        </Badge>
                      ) : null}
                    </div>
                  }
                />
                <CardBody className="flex flex-wrap items-end gap-3">
                  <p className="text-xs text-ink-400">
                    {t("admin.joined")}: {formatDate(user.created_at, locale)}
                  </p>

                  <ActionForm action={setUserRoleAction} showMessage className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <div className="min-w-[10rem]">
                      <label htmlFor={`role-${user.id}`} className="mb-1 block text-xs font-semibold text-ink-600">
                        {t("admin.role")}
                      </label>
                      <Select id={`role-${user.id}`} name="role" defaultValue={user.role}>
                        {USER_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {t(`auth.role.${role}` as never)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <SubmitButton variant="secondary">{t("admin.changeRole")}</SubmitButton>
                  </ActionForm>

                  <ActionForm action={setUserBlockedAction} showMessage>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="blocked" value={user.is_blocked ? "false" : "true"} />
                    <SubmitButton variant={user.is_blocked ? "secondary" : "danger"}>
                      {user.is_blocked ? t("admin.unblock") : t("admin.block")}
                    </SubmitButton>
                  </ActionForm>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-ink-500">{t("admin.roleSafety")}</p>
    </div>
  );
}
