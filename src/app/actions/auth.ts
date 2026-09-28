"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  changePassword,
  requestPasswordReset,
  resetPasswordWithToken,
  signIn,
  signUp,
} from "@/lib/auth/session";
import { dataBackend } from "@/lib/env";
import { getDataClient } from "@/lib/db";
import { getSessionUser, syncLocalUserMetadata } from "@/lib/auth/session";
import { actionError, actionOk, fieldErrorsFrom, formBool, formValue, type ActionState } from "@/lib/actions/state";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/schemas";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

const SET_COOKIE_SAFE = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

async function setLocaleCookie(locale: string) {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  try {
    store.set(LOCALE_COOKIE, locale, SET_COOKIE_SAFE);
  } catch {
    /* read-only context */
  }
}

async function setSimpleModeCookie(simple: boolean) {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  try {
    store.set("xfarm-simple-mode", simple ? "1" : "0", SET_COOKIE_SAFE);
  } catch {
    /* read-only context */
  }
}

export async function signUpAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
    fullName: formValue(formData, "fullName"),
    phone: formValue(formData, "phone"),
    village: formValue(formData, "village"),
    district: formValue(formData, "district"),
    state: formValue(formData, "state") || "Andhra Pradesh",
    role: formValue(formData, "role") || "farmer",
    preferredLanguage: formValue(formData, "preferredLanguage") || "en",
    simpleMode: formBool(formData, "simpleMode"),
  });

  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const result = await signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone ?? null,
    village: parsed.data.village ?? null,
    district: parsed.data.district ?? null,
    state: parsed.data.state ?? "Andhra Pradesh",
    role: parsed.data.role,
    preferredLanguage: parsed.data.preferredLanguage,
    simpleMode: parsed.data.simpleMode,
  });

  if (!result.ok) {
    return actionError(result.error);
  }

  await setLocaleCookie(parsed.data.preferredLanguage);
  await setSimpleModeCookie(parsed.data.simpleMode);

  if (result.needsEmailConfirmation) {
    return actionOk(result.message ?? "Check your email to confirm your account.");
  }

  redirect("/dashboard?welcome=1");
}

export async function signInAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formValue(formData, "email"),
    password: formValue(formData, "password"),
    next: formValue(formData, "next"),
  });

  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) {
    return actionError(result.error);
  }

  const user = await getSessionUser();
  if (user) {
    await setLocaleCookie(user.profile.preferred_language);
    await setSimpleModeCookie(user.profile.simple_mode);
  }

  const next = parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/dashboard";
  redirect(next);
}

export async function forgotPasswordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formValue(formData, "email") });
  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const result = await requestPasswordReset(parsed.data.email);
  if (!result.ok) return actionError(result.error);

  return actionOk(result.message, {
    devResetUrl: result.devToken ? `/reset-password?token=${result.devToken}` : undefined,
  });
}

export async function resetPasswordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formValue(formData, "token"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const result = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
  if (!result.ok) return actionError(result.error);

  return actionOk(result.message ?? "Password updated.", { done: true });
}

export async function changePasswordAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formValue(formData, "currentPassword"),
    password: formValue(formData, "password"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const result = await changePassword(parsed.data.currentPassword, parsed.data.password);
  if (!result.ok) return actionError(result.error);
  return actionOk("Your password has been changed.");
}

export async function updateProfileAction(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return actionError("Your session expired. Please sign in again.");

  const parsed = profileSchema.safeParse({
    full_name: formValue(formData, "full_name"),
    phone: formValue(formData, "phone"),
    village: formValue(formData, "village"),
    district: formValue(formData, "district"),
    state: formValue(formData, "state"),
    bio: formValue(formData, "bio"),
    preferred_language: formValue(formData, "preferred_language") || user.profile.preferred_language,
  });

  if (!parsed.success) {
    return actionError("Please check the highlighted fields.", {
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    });
  }

  const simpleMode = formBool(formData, "simple_mode");

  const db = await getDataClient();
  const { error } = await db
    .from("profiles")
    .update({ ...parsed.data, simple_mode: simpleMode } as unknown as Record<string, unknown>)
    .eq("id", user.id);

  if (error) return actionError("We could not save your profile right now. Please try again.");

  if (dataBackend() === "local") {
    await syncLocalUserMetadata(user.id, {
      full_name: parsed.data.full_name,
      preferred_language: parsed.data.preferred_language,
      simple_mode: simpleMode,
      phone: parsed.data.phone ?? null,
    });
  }

  await setLocaleCookie(parsed.data.preferred_language);
  await setSimpleModeCookie(simpleMode);

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return actionOk("Profile saved.");
}

export async function updatePreferencesAction(formData: FormData): Promise<ActionState> {
  const simpleMode = formBool(formData, "simple_mode");
  const locale = formValue(formData, "preferred_language");

  if (isLocale(locale)) await setLocaleCookie(locale);
  await setSimpleModeCookie(simpleMode);

  const user = await getSessionUser();
  if (user) {
    const db = await getDataClient();
    await db
      .from("profiles")
      .update({ simple_mode: simpleMode, ...(isLocale(locale) ? { preferred_language: locale } : {}) })
      .eq("id", user.id);
  }

  return actionOk("Preferences updated.");
}
