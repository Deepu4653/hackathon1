/**
 * Authentication facade.
 *
 * One API, two implementations:
 *   • Supabase Auth (email + password, cookie sessions, recovery links)
 *   • The local reference runtime (scrypt password hashes, signed JWT access
 *     tokens, hashed refresh tokens in PostgreSQL)
 *
 * Server-only: every function here touches cookies or the database.
 */

import { redirect } from "next/navigation";
import { dataBackend } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { getServiceDataClient } from "@/lib/db";
import { getDataClient } from "@/lib/db";
import type { Profile, UserRole } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  clearSessionCookies,
  currentRequestUserAgent,
  getResolvedSession,
  writeSessionCookies,
} from "./context";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  createOpaqueToken,
  hashToken,
} from "./tokens";
import {
  consumePasswordResetToken,
  createLocalSession,
  createLocalUser,
  createPasswordResetToken,
  findUserByEmail,
  findUserById,
  revokeAllSessions,
  revokeSessionByRefreshToken,
  touchLastSignIn,
  updateLocalPassword,
  updateLocalUserMetadata,
  verifyPassword,
} from "./local-store";
import { sendPasswordResetEmail } from "./mail";

export interface SessionUser {
  id: string;
  email: string;
  profile: Profile;
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  role: Exclude<UserRole, "admin">;
  preferredLanguage: "en" | "te" | "hi";
  simpleMode: boolean;
}

export type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean; message?: string }
  | { ok: false; error: string };

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isBootstrapAdmin(email: string): boolean {
  return serverEnv.adminEmails.includes(normaliseEmail(email));
}

/** Loads the caller's profile row (creating it if a trigger has not yet). */
async function loadProfile(userId: string, email: string | null): Promise<Profile | null> {
  const db = await getDataClient();
  const { data } = await db
    .from<Profile>("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (data) return data as Profile;

  // Self-repair path: a profile row is required for the whole app to work.
  const { data: created } = await db
    .from<Profile>("profiles")
    .insert({ id: userId, email, full_name: email?.split("@")[0] ?? "Farmer" })
    .select("*")
    .maybeSingle();

  return (created as Profile) ?? null;
}

/**
 * Promotes accounts listed in ADMIN_EMAILS. Requires the service-role context
 * because role changes are blocked for regular users by a database trigger.
 */
async function applyAdminBootstrap(userId: string, email: string, profile: Profile): Promise<Profile> {
  if (profile.role === "admin" || !isBootstrapAdmin(email)) return profile;
  try {
    const service = await getServiceDataClient();
    const { data } = await service
      .from<Profile>("profiles")
      .update({ role: "admin" })
      .eq("id", userId)
      .select("*")
      .maybeSingle();
    if (data) {
      await service.from("audit_logs").insert({
        actor_id: null,
        action: "admin.bootstrap",
        entity: "profiles",
        entity_id: userId,
        meta: { reason: "ADMIN_EMAILS configuration" },
      });
      return data as Profile;
    }
  } catch (error) {
    console.warn(
      "[auth] Could not promote bootstrap admin (service-role key missing?):",
      error instanceof Error ? error.message : error,
    );
  }
  return profile;
}

/** Current signed-in user with profile, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (dataBackend() === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const email = user.email ?? "";
    const profile = await loadProfile(user.id, email);
    if (!profile || profile.is_blocked) return null;
    return { id: user.id, email, profile: await applyAdminBootstrap(user.id, email, profile) };
  }

  const session = await getResolvedSession();
  if (!session) return null;
  const user = await findUserById(session.userId);
  if (!user) return null;
  const profile = await loadProfile(user.id, user.email);
  if (!profile || profile.is_blocked) return null;
  return { id: user.id, email: user.email, profile: await applyAdminBootstrap(user.id, user.email, profile) };
}

export async function requireUser(nextPath = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return user;
}

export async function requireRole(roles: UserRole[], nextPath = "/dashboard"): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!roles.includes(user.profile.role)) {
    redirect("/dashboard?error=forbidden");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireRole(["admin"], "/admin");
}

// ---------------------------------------------------------------------------
// Sign up / sign in / sign out
// ---------------------------------------------------------------------------

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  const email = normaliseEmail(input.email);

  if (dataBackend() === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          phone: input.phone ?? null,
          village: input.village ?? null,
          district: input.district ?? null,
          state: input.state ?? "Andhra Pradesh",
          role: input.role,
          preferred_language: input.preferredLanguage,
          simple_mode: input.simpleMode,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`,
      },
    });

    if (error) return { ok: false, error: error.message };

    if (!data.session) {
      return {
        ok: true,
        needsEmailConfirmation: true,
        message: "Account created. Check your email to confirm your address, then sign in.",
      };
    }
    return { ok: true };
  }

  // ---- local runtime ------------------------------------------------------
  const existing = await findUserByEmail(email);
  if (existing) {
    return { ok: false, error: "An account with this email already exists. Try signing in instead." };
  }

  const user = await createLocalUser({
    email,
    password: input.password,
    fullName: input.fullName,
    phone: input.phone ?? null,
    village: input.village ?? null,
    district: input.district ?? null,
    state: input.state ?? "Andhra Pradesh",
    role: input.role,
    preferredLanguage: input.preferredLanguage,
    simpleMode: input.simpleMode,
    adminBootstrap: isBootstrapAdmin(email),
  });

  const { userAgent, ip } = await currentRequestUserAgent();
  const refreshToken = createOpaqueToken();
  const session = await createLocalSession(user.id, refreshToken, REFRESH_TOKEN_TTL_SECONDS, userAgent, ip);
  await touchLastSignIn(user.id);
  await writeSessionCookies(user.id, user.email, session.id, refreshToken);
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const normalised = normaliseEmail(email);

  if (dataBackend() === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email: normalised, password });
    if (error) {
      return { ok: false, error: error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message };
    }
    return { ok: true };
  }

  const user = await findUserByEmail(normalised);
  const genericError = "Incorrect email or password.";
  if (!user) {
    // Constant-ish work to avoid user enumeration through timing.
    await verifyPassword(password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
    return { ok: false, error: genericError };
  }
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
    return { ok: false, error: "This account is temporarily suspended. Please contact support." };
  }
  const valid = await verifyPassword(password, user.encrypted_password);
  if (!valid) return { ok: false, error: genericError };

  const { userAgent, ip } = await currentRequestUserAgent();
  const refreshToken = createOpaqueToken();
  const session = await createLocalSession(user.id, refreshToken, REFRESH_TOKEN_TTL_SECONDS, userAgent, ip);
  await touchLastSignIn(user.id);
  await writeSessionCookies(user.id, user.email, session.id, refreshToken);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (dataBackend() === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return;
  }
  const refreshToken = await import("next/headers").then((mod) =>
    mod.cookies().then((store) => store.get("xfarm-refresh-token")?.value),
  );
  if (refreshToken) await revokeSessionByRefreshToken(refreshToken);
  await clearSessionCookies();
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export type ResetRequestResult =
  | { ok: true; devToken?: string; emailed: boolean; message: string }
  | { ok: false; error: string };

export async function requestPasswordReset(email: string): Promise<ResetRequestResult> {
  const normalised = normaliseEmail(email);

  if (dataBackend() === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalised, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password`,
    });
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      emailed: true,
      message: "If that email is registered, a reset link has been sent.",
    };
  }

  const user = await findUserByEmail(normalised);
  const genericMessage = "If that email is registered, a reset link has been sent.";
  if (!user) {
    return { ok: true, emailed: false, message: genericMessage };
  }

  const token = createOpaqueToken(32);
  await createPasswordResetToken(user.id, hashToken(token));
  const link = `/reset-password?token=${token}`;

  const delivery = await sendPasswordResetEmail(user.email, link);
  return {
    ok: true,
    emailed: delivery.sent,
    devToken: delivery.sent ? undefined : token,
    message: delivery.sent
      ? genericMessage
      : "Email delivery is not configured on this deployment, so the reset link is shown below (development mode).",
  };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<AuthResult> {
  const consumed = await consumePasswordResetToken(hashToken(token));
  if (!consumed) {
    return { ok: false, error: "This reset link is invalid or has expired. Please request a new one." };
  }
  await updateLocalPassword(consumed.userId, newPassword);
  await revokeAllSessions(consumed.userId);
  await clearSessionCookies();
  return { ok: true, message: "Password updated. You can now sign in with your new password." };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: "You need to sign in again." };

  if (dataBackend() === "supabase") {
    const supabase = await createSupabaseServerClient();
    const verify = await supabase.auth.signInWithPassword({
      email: session.email,
      password: currentPassword,
    });
    if (verify.error) return { ok: false, error: "Your current password is incorrect." };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  const user = await findUserById(session.id);
  if (!user) return { ok: false, error: "Account not found." };
  const valid = await verifyPassword(currentPassword, user.encrypted_password);
  if (!valid) return { ok: false, error: "Your current password is incorrect." };
  await updateLocalPassword(user.id, newPassword);
  return { ok: true };
}

/** Keeps auth.users metadata in step with profile edits (local mode only). */
export async function syncLocalUserMetadata(userId: string, patch: Record<string, unknown>) {
  if (dataBackend() === "supabase") return;
  try {
    await updateLocalUserMetadata(userId, patch);
  } catch {
    /* metadata is a convenience mirror, never the source of truth */
  }
}

export async function resolveSessionForRequest(
  userId: string,
  email: string,
  sessionId: string,
  refreshToken: string,
): Promise<void> {
  await writeSessionCookies(userId, email, sessionId, refreshToken);
}

export { ACCESS_TOKEN_TTL_SECONDS };
