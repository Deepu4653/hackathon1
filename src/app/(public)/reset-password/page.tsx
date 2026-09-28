import Link from "next/link";
import { Card, CardBody, CardHeader, Callout } from "@/components/ui";
import { ResetPasswordForm } from "@/components/auth-forms";
import { resetPasswordAction } from "@/app/actions/auth";
import { getTranslatorForRequest } from "@/lib/preferences";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("meta.resetPassword");

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { t } = await getTranslatorForRequest();
  const token = params.token?.trim() ?? "";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")} />
        <CardBody>
          {token ? (
            <ResetPasswordForm
              action={resetPasswordAction}
              token={token}
              supportNote={t("auth.resetSupportNote")}
              labels={{
                password: t("auth.newPassword"),
                confirmPassword: t("auth.confirmPassword"),
                button: t("auth.resetButton"),
                pending: t("auth.resetting"),
                hint: t("auth.passwordHint"),
              }}
            />
          ) : (
            <div className="space-y-3">
              <Callout tone="warning" title={t("auth.resetTokenMissing")}>
                {t("auth.resetTokenMissingBody")}
              </Callout>
              <Link href="/forgot-password" className="text-sm font-semibold text-field-700 hover:underline">
                {t("auth.forgotTitle")}
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
