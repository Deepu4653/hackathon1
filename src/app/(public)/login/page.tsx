import { Suspense } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader, Callout } from "@/components/ui";
import { SignInForm, InlineLoader } from "@/components/auth-forms";
import { signInAction } from "@/app/actions/auth";
import { getTranslatorForRequest } from "@/lib/preferences";
import { dataBackend } from "@/lib/env";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("auth.signInTitle");

async function LoginForm({ nextPath }: { nextPath?: string }) {
  const { t } = await getTranslatorForRequest();

  return (
    <>
      <Card>
        <CardHeader title={t("auth.signInTitle")} subtitle={t("auth.signInSubtitle")} />
        <CardBody>
          <SignInForm
            action={signInAction}
            nextPath={nextPath}
            labels={{
              title: t("auth.signInTitle"),
              subtitle: t("auth.signInSubtitle"),
              email: t("auth.email"),
              password: t("auth.password"),
              button: t("auth.signInButton"),
              pending: t("auth.signingIn"),
              forgot: t("auth.forgotTitle"),
              noAccount: t("auth.noAccount"),
              signUp: t("auth.createAccount"),
            }}
          />
        </CardBody>
      </Card>

      {dataBackend() === "local" ? (
        <Callout tone="info" title={t("auth.localMode")}>
          {t("auth.localModeBody")}
        </Callout>
      ) : null}

      <p className="text-center text-sm text-ink-500">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-semibold text-field-700 hover:underline">
          {t("auth.createAccount")}
        </Link>
      </p>
    </>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const { t } = await getTranslatorForRequest();
  const nextPath = params.next && params.next.startsWith("/") ? params.next : "/dashboard";

  return (
    <div className="mx-auto max-w-md space-y-4">
      {params.reset ? <Callout tone="success" title={t("auth.resetSuccess")}>{t("auth.resetSuccessBody")}</Callout> : null}
      <Suspense fallback={<InlineLoader label={t("common.loading")} />}>
        <LoginForm nextPath={nextPath} />
      </Suspense>
    </div>
  );
}
