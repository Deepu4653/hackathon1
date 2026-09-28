import { Card, CardBody, CardHeader, Callout } from "@/components/ui";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { forgotPasswordAction } from "@/app/actions/auth";
import { getTranslatorForRequest } from "@/lib/preferences";
import { isMailConfigured } from "@/lib/auth/mail-env";

export const metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const { t } = await getTranslatorForRequest();
  const mailReady = isMailConfigured();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card>
        <CardHeader title={t("auth.forgotTitle")} subtitle={t("auth.forgotSubtitle")} />
        <CardBody>
          <ForgotPasswordForm
            action={forgotPasswordAction}
            labels={{
              email: t("auth.email"),
              button: t("auth.sendResetLink"),
              pending: t("auth.sendingResetLink"),
              devNotice: t("auth.devResetNotice"),
              openLink: t("auth.openResetLink"),
              backToLogin: t("auth.backToLogin"),
            }}
          />
        </CardBody>
      </Card>

      {!mailReady ? (
        <Callout tone="warning" title={t("auth.mailNotConfigured")}>
          {t("auth.mailNotConfiguredBody")}
        </Callout>
      ) : null}

      <Callout tone="info" title={t("auth.resetLinkNoteTitle")}>
        {t("auth.resetLinkNote")}
      </Callout>
    </div>
  );
}
