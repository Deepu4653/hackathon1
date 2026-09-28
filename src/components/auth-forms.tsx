"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { FieldError, FormMessage, Label, Select, SubmitButton, TextArea, TextInput } from "@/components/forms";
import { LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";
import type { ActionState } from "@/lib/actions/state";

type Action = (state: ActionState | null, formData: FormData) => Promise<ActionState>;

function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 pr-12 text-base text-ink-900 transition focus:border-field-500 focus:outline-none focus:ring-4 focus:ring-field-100"
          style={{ minHeight: "var(--tap-min)" }}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-ink-400 hover:bg-ink-100"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {hint ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function SignInForm({
  action,
  labels,
  nextPath,
}: {
  action: Action;
  labels: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    button: string;
    pending: string;
    forgot: string;
    noAccount: string;
    signUp: string;
  };
  nextPath?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath ?? "/dashboard"} />
      <FormMessage state={state} />
      <div>
        <Label htmlFor="email">{labels.email}</Label>
        <TextInput id="email" name="email" type="email" autoComplete="email" required inputMode="email" />
        <FieldError>{state?.fieldErrors?.email}</FieldError>
      </div>
      <PasswordInput
        id="password"
        name="password"
        label={labels.password}
        autoComplete="current-password"
        error={state?.fieldErrors?.password}
      />
      <SubmitButton pendingLabel={labels.pending} className="w-full" dataPrimary>
        {labels.button}
      </SubmitButton>
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Link href="/forgot-password" className="font-semibold text-field-700 hover:underline">
          {labels.forgot}
        </Link>
        <span className="text-ink-500">
          {labels.noAccount}{" "}
          <Link href="/signup" className="font-semibold text-field-700 hover:underline">
            {labels.signUp}
          </Link>
        </span>
      </div>
    </form>
  );
}

export function SignUpForm({
  action,
  labels,
  roleOptions,
  defaultLanguage,
}: {
  action: Action;
  labels: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    passwordHint: string;
    village: string;
    district: string;
    state: string;
    role: string;
    language: string;
    simpleMode: string;
    simpleModeHelp: string;
    button: string;
    pending: string;
    haveAccount: string;
    signIn: string;
  };
  roleOptions: Array<{ value: string; label: string }>;
  defaultLanguage: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-400">
          {labels.role}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fullName">{labels.fullName}</Label>
            <TextInput id="fullName" name="fullName" autoComplete="name" required />
            <FieldError>{errors.fullName}</FieldError>
          </div>
          <div>
            <Label htmlFor="phone" hint="optional">
              {labels.phone}
            </Label>
            <TextInput id="phone" name="phone" inputMode="tel" autoComplete="tel" />
            <FieldError>{errors.phone}</FieldError>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="email">{labels.email}</Label>
            <TextInput id="email" name="email" type="email" inputMode="email" autoComplete="email" required />
            <FieldError>{errors.email}</FieldError>
          </div>
          <div>
            <Label htmlFor="role">{labels.role}</Label>
            <Select id="role" name="role" defaultValue="farmer">
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PasswordInput
            id="password"
            name="password"
            label={labels.password}
            autoComplete="new-password"
            hint={labels.passwordHint}
            error={errors.password}
          />
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            label={labels.confirmPassword}
            autoComplete="new-password"
            error={errors.confirmPassword}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="village" hint="optional">
              {labels.village}
            </Label>
            <TextInput id="village" name="village" />
          </div>
          <div>
            <Label htmlFor="district" hint="optional">
              {labels.district}
            </Label>
            <TextInput id="district" name="district" />
          </div>
          <div>
            <Label htmlFor="state">{labels.state}</Label>
            <TextInput id="state" name="state" defaultValue="Andhra Pradesh" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="preferredLanguage">{labels.language}</Label>
            <Select id="preferredLanguage" name="preferredLanguage" defaultValue={defaultLanguage}>
              {LOCALES.map((locale) => (
                <option key={locale} value={locale}>
                  {LOCALE_LABELS[locale].native} — {LOCALE_LABELS[locale].english}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white px-3.5 py-3">
            <input type="checkbox" name="simpleMode" defaultChecked className="mt-1 size-5 accent-[var(--color-field-600)]" />
            <span>
              <span className="block text-sm font-semibold text-ink-800">{labels.simpleMode}</span>
              <span className="block text-xs text-ink-500">{labels.simpleModeHelp}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <SubmitButton pendingLabel={labels.pending} className="w-full" dataPrimary>
        {labels.button}
      </SubmitButton>

      <p className="text-sm text-ink-500">
        {labels.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-field-700 hover:underline">
          {labels.signIn}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm({
  action,
  labels,
}: {
  action: Action;
  labels: {
    email: string;
    button: string;
    pending: string;
    devNotice: string;
    openLink: string;
    backToLogin: string;
  };
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div>
        <Label htmlFor="email">{labels.email}</Label>
        <TextInput id="email" name="email" type="email" inputMode="email" autoComplete="email" required />
        <FieldError>{state?.fieldErrors?.email}</FieldError>
      </div>
      <SubmitButton pendingLabel={labels.pending} className="w-full" dataPrimary>
        {labels.button}
      </SubmitButton>

      {state?.ok && state.devResetUrl ? (
        <div className="rounded-xl border border-soil-200 bg-soil-50 p-3 text-sm">
          <p className="font-semibold text-soil-800">{labels.devNotice}</p>
          <Link
            href={String(state.devResetUrl)}
            className="mt-2 inline-block rounded-lg bg-soil-500 px-3 py-2 font-semibold text-white"
          >
            {labels.openLink}
          </Link>
        </div>
      ) : null}

      <Link href="/login" className="block text-sm font-semibold text-field-700 hover:underline">
        {labels.backToLogin}
      </Link>
    </form>
  );
}

export function ResetPasswordForm({
  action,
  token,
  labels,
  supportNote,
}: {
  action: Action;
  token: string;
  labels: {
    password: string;
    confirmPassword: string;
    button: string;
    pending: string;
    hint: string;
  };
  supportNote?: string | null;
}) {
  const [state, formAction] = useActionState(action, null);
  const done = Boolean(state?.ok && state?.done);

  if (done) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
        >
          {labels.button}
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-3">
        <FormMessage state={{ ok: false, error: supportNote ?? "This reset link is incomplete." }} />
        <Link href="/forgot-password" className="text-sm font-semibold text-field-700 hover:underline">
          {labels.hint}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <PasswordInput
        id="password"
        name="password"
        label={labels.password}
        autoComplete="new-password"
        error={state?.fieldErrors?.password}
        hint={labels.hint}
      />
      <PasswordInput
        id="confirmPassword"
        name="confirmPassword"
        label={labels.confirmPassword}
        autoComplete="new-password"
        error={state?.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingLabel={labels.pending} className="w-full" dataPrimary>
        {labels.button}
      </SubmitButton>
    </form>
  );
}

export function ChangePasswordForm({
  action,
  labels,
}: {
  action: Action;
  labels: {
    current: string;
    next: string;
    confirm: string;
    button: string;
    pending: string;
  };
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <PasswordInput
        id="currentPassword"
        name="currentPassword"
        label={labels.current}
        autoComplete="current-password"
        error={state?.fieldErrors?.currentPassword}
      />
      <PasswordInput
        id="newPassword"
        name="password"
        label={labels.next}
        autoComplete="new-password"
        error={state?.fieldErrors?.password}
      />
      <PasswordInput
        id="confirmNewPassword"
        name="confirmPassword"
        label={labels.confirm}
        autoComplete="new-password"
        error={state?.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingLabel={labels.pending}>{labels.button}</SubmitButton>
    </form>
  );
}

/** Small helper for pages that need a compact, inline feedback area. */
export function InlineLoader({ label }: { label: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-500">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </span>
  );
}

export { TextArea };
