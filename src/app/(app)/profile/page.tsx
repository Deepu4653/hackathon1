import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, DataRow, PageHeader, formatDate } from "@/components/ui";
import { ActionForm, Label, Select, SubmitButton, TextArea, TextInput } from "@/components/forms";
import { updateProfileAction, changePasswordAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const { t, locale } = await getTranslatorForRequest(user.profile.simple_mode);
  const profile = user.profile;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
        badge={<Badge tone="green" icon={<ShieldCheck className="size-3.5" aria-hidden />}>{t(`auth.role.${profile.role}` as never)}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader icon={<UserRound className="size-5" aria-hidden />} title={t("profile.details")} subtitle={t("profile.subtitle")} />
          <CardBody>
            <ActionForm action={updateProfileAction} showMessage>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="full_name">{t("auth.fullName")}</Label>
                      <TextInput id="full_name" name="full_name" required maxLength={120} defaultValue={profile.full_name} />
                    </div>
                    <div>
                      <Label htmlFor="phone">{t("auth.phone")}</Label>
                      <TextInput id="phone" name="phone" inputMode="tel" maxLength={15} defaultValue={profile.phone ?? ""} />
                    </div>
                    <div>
                      <Label htmlFor="preferred_language">{t("profile.language")}</Label>
                      <Select id="preferred_language" name="preferred_language" defaultValue={profile.preferred_language}>
                        {LOCALES.map((code) => (
                          <option key={code} value={code}>
                            {LOCALE_LABELS[code].native} — {LOCALE_LABELS[code].english}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="village">{t("farms.village")}</Label>
                      <TextInput id="village" name="village" maxLength={80} defaultValue={profile.village ?? ""} />
                    </div>
                    <div>
                      <Label htmlFor="district">{t("farms.district")}</Label>
                      <TextInput id="district" name="district" maxLength={80} defaultValue={profile.district ?? ""} />
                    </div>
                    <div>
                      <Label htmlFor="state">{t("farms.state")}</Label>
                      <TextInput id="state" name="state" maxLength={80} defaultValue={profile.state ?? "Andhra Pradesh"} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="bio" hint={t("common.optional")}>
                        {t("profile.bio")}
                      </Label>
                      <TextArea id="bio" name="bio" rows={3} maxLength={400} defaultValue={profile.bio ?? ""} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="flex items-start gap-3 rounded-xl border border-ink-100 bg-ink-50/50 p-3">
                        <input
                          type="checkbox"
                          name="simple_mode"
                          value="on"
                          defaultChecked={profile.simple_mode}
                          className="mt-0.5 size-5 rounded border-ink-300"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-ink-800">{t("simple.title")}</span>
                          <span className="block text-xs text-ink-500">{t("simple.description")}</span>
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="mt-4">
                    <SubmitButton dataPrimary>{t("profile.saveButton")}</SubmitButton>
                  </div>
            </ActionForm>
          </CardBody>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardBody className="flex items-center gap-3.5">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="size-16 rounded-2xl object-cover"
                />
              ) : (
                <span className="grid size-16 place-items-center rounded-2xl bg-field-100 text-xl font-bold text-field-700">
                  {profile.full_name.slice(0, 1).toUpperCase() || "?"}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-ink-900">{profile.full_name}</p>
                <p className="flex items-center gap-1.5 truncate text-xs text-ink-500">
                  <Mail className="size-3.5" aria-hidden />
                  {profile.email ?? t("common.notAvailable")}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-field-700">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {t(`auth.role.${profile.role}` as never)}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("profile.account")} />
            <CardBody>
              <dl>
                <DataRow label={t("profile.joined")} value={formatDate(profile.created_at, locale)} />
                <DataRow label={t("profile.language")} value={LOCALE_LABELS[profile.preferred_language].native} />
                <DataRow label={t("simple.title")} value={profile.simple_mode ? t("common.yes") : t("common.no")} />
              </dl>
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-500">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {t("profile.privacyNote")}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<KeyRound className="size-5" aria-hidden />} title={t("auth.changePassword")} />
            <CardBody>
              <ActionForm action={changePasswordAction} showMessage>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="currentPassword">{t("auth.currentPassword")}</Label>
                        <TextInput id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
                      </div>
                      <div>
                        <Label htmlFor="password">{t("auth.newPassword")}</Label>
                        <TextInput id="password" name="password" type="password" required autoComplete="new-password" />
                      </div>
                      <div>
                        <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
                        <TextInput id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <SubmitButton variant="secondary">{t("auth.changePassword")}</SubmitButton>
                    </div>
              </ActionForm>
              <p className="mt-3 text-xs text-ink-500">
                {t("profile.forgotInstead")}{" "}
                <Link href="/forgot-password" className="font-semibold text-field-700 hover:underline">
                  {t("auth.forgotTitle")}
                </Link>
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
