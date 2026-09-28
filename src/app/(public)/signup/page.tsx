import Link from "next/link";
import { Card, CardBody, CardHeader, Callout } from "@/components/ui";
import { SignUpForm } from "@/components/auth-forms";
import { signUpAction } from "@/app/actions/auth";
import { getTranslatorForRequest } from "@/lib/preferences";
import { SELF_ASSIGNABLE_ROLES } from "@/lib/db/types";
import { dataBackend } from "@/lib/env";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  const { t, locale } = await getTranslatorForRequest();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader title={t("auth.signUpTitle")} subtitle={t("auth.signUpSubtitle")} />
        <CardBody>
          <SignUpForm
            action={signUpAction}
            defaultLanguage={locale}
            roleOptions={SELF_ASSIGNABLE_ROLES.map((role) => ({ value: role, label: t(`auth.role.${role}` as never) }))}
            labels={{
              fullName: t("auth.fullName"),
              email: t("auth.email"),
              phone: t("auth.phone"),
              password: t("auth.password"),
              confirmPassword: t("auth.confirmPassword"),
              passwordHint: t("auth.passwordHint"),
              village: t("auth.village"),
              district: t("auth.district"),
              state: t("auth.state"),
              role: t("auth.roleLabel"),
              language: t("auth.language"),
              simpleMode: t("simple.title"),
              simpleModeHelp: t("simple.description"),
              button: t("auth.createAccountButton"),
              pending: t("auth.creatingAccount"),
              haveAccount: t("auth.haveAccount"),
              signIn: t("auth.signInButton"),
            }}
          />
        </CardBody>
      </Card>

      <Callout tone="info" title={t("auth.roleNoteTitle")}>
        {t("auth.roleNote")}
      </Callout>

      {dataBackend() === "local" ? (
        <Callout tone="warning" title={t("auth.localMode")}>
          {t("auth.localModeBody")}
        </Callout>
      ) : null}

      <p className="text-center text-sm text-ink-500">
        {t("auth.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-field-700 hover:underline">
          {t("auth.signInButton")}
        </Link>
      </p>
    </div>
  );
}
