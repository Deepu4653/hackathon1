/**
 * Local (non-Supabase) credential store.
 *
 * Passwords are hashed with scrypt + a per-user random salt and verified in
 * constant time. Nothing here is ever exposed to the browser: it is only used by
 * server actions / route handlers.
 */

import crypto from "node:crypto";
import { promisify } from "node:util";
import { withAuthContext } from "@/lib/db/local/engine";
import { internalContext, serviceContext } from "@/lib/db/local/auth-context";
import type { Language, UserRole } from "@/lib/db/types";

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export interface LocalAuthUser {
  id: string;
  email: string;
  encrypted_password: string | null;
  raw_user_meta_data: Record<string, unknown>;
  banned_until: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const derived = await scrypt(password, Buffer.from(saltB64, "base64"), KEY_LENGTH);
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(expected, derived);
}

async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  return withAuthContext(internalContext, async (db) => {
    const result = await db.query<T>(sql, params);
    return result.rows;
  });
}

export async function findUserByEmail(email: string): Promise<LocalAuthUser | null> {
  const rows = await query<LocalAuthUser>(
    "select id, email, encrypted_password, raw_user_meta_data, banned_until, email_confirmed_at, last_sign_in_at, created_at from auth.users where lower(email) = lower($1) limit 1",
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<LocalAuthUser | null> {
  const rows = await query<LocalAuthUser>(
    "select id, email, encrypted_password, raw_user_meta_data, banned_until, email_confirmed_at, last_sign_in_at, created_at from auth.users where id = $1 limit 1",
    [id],
  );
  return rows[0] ?? null;
}

export interface CreateLocalUserInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  district?: string | null;
  state?: string | null;
  village?: string | null;
  role: UserRole;
  preferredLanguage: Language;
  simpleMode: boolean;
  adminBootstrap?: boolean;
}

export async function createLocalUser(input: CreateLocalUserInput): Promise<LocalAuthUser> {
  const passwordHash = await hashPassword(input.password);
  const rows = await query<LocalAuthUser>(
    `insert into auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at)
     values ($1, $2, $3::jsonb, now())
     returning id, email, encrypted_password, raw_user_meta_data, banned_until, email_confirmed_at, last_sign_in_at, created_at`,
    [
      input.email.toLowerCase(),
      passwordHash,
      JSON.stringify({
        full_name: input.fullName,
        phone: input.phone ?? null,
        village: input.village ?? null,
        district: input.district ?? null,
        state: input.state ?? "Andhra Pradesh",
        role: input.adminBootstrap ? "farmer" : input.role,
        preferred_language: input.preferredLanguage,
        simple_mode: input.simpleMode,
      }),
    ],
  );

  const user = rows[0];

  // The `handle_new_user` trigger mirrors the profile row. Promote when this
  // email is listed in ADMIN_EMAILS (server-controlled, never client input).
  if (input.adminBootstrap) {
    // Promoting to admin is a privileged operation: the anti-escalation trigger
    // accepts it only from a service-role context (ADMIN_EMAILS is server-side).
    await withAuthContext(serviceContext, async (db) => {
      await db.query("update public.profiles set role = 'admin' where id = $1", [user.id]);
    });
  }

  return user;
}

export async function touchLastSignIn(userId: string): Promise<void> {
  await query("update auth.users set last_sign_in_at = now() where id = $1", [userId]);
  await query("update public.profiles set last_seen_at = now() where id = $1", [userId]);
}

export async function updateLocalPassword(userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await query("update auth.users set encrypted_password = $2, updated_at = now() where id = $1", [
    userId,
    hash,
  ]);
}

export async function updateLocalUserMetadata(
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await query(
    "update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || $2::jsonb, updated_at = now() where id = $1",
    [userId, JSON.stringify(patch)],
  );
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface LocalSession {
  id: string;
  user_id: string;
  refresh_token: string;
  expires_at: string;
  revoked_at: string | null;
}

export async function createLocalSession(
  userId: string,
  refreshToken: string,
  ttlSeconds: number,
  userAgent?: string | null,
  ip?: string | null,
): Promise<LocalSession> {
  const rows = await query<LocalSession>(
    `insert into auth.sessions (user_id, refresh_token, user_agent, ip, expires_at)
     values ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval)
     returning id, user_id, refresh_token, expires_at, revoked_at`,
    [userId, refreshToken, userAgent ?? null, ip ?? null, String(ttlSeconds)],
  );
  return rows[0];
}

export async function findSessionByRefreshToken(refreshToken: string): Promise<LocalSession | null> {
  const rows = await query<LocalSession>(
    "select id, user_id, refresh_token, expires_at, revoked_at from auth.sessions where refresh_token = $1 limit 1",
    [refreshToken],
  );
  return rows[0] ?? null;
}

export async function rotateSessionRefreshToken(
  sessionId: string,
  refreshToken: string,
  ttlSeconds: number,
): Promise<void> {
  await query(
    "update auth.sessions set refresh_token = $2, updated_at = now(), expires_at = now() + ($3 || ' seconds')::interval where id = $1",
    [sessionId, refreshToken, String(ttlSeconds)],
  );
}

/**
 * True only while the session row exists, is unrevoked and unexpired.
 *
 * Access tokens live for an hour, so signing out / revoking a session must be
 * checked against the database — otherwise a stolen cookie would keep working
 * until it expired.
 */
export async function isSessionLive(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  const rows = await query<{ live: boolean }>(
    `select (revoked_at is null and expires_at > now()) as live
       from auth.sessions
      where id = $1`,
    [sessionId],
  );
  return rows[0]?.live === true;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await query("update auth.sessions set revoked_at = now() where id = $1", [sessionId]);
}

export async function revokeSessionByRefreshToken(refreshToken: string): Promise<void> {
  await query("update auth.sessions set revoked_at = now() where refresh_token = $1", [refreshToken]);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await query("update auth.sessions set revoked_at = now() where user_id = $1 and revoked_at is null", [
    userId,
  ]);
}

// ---------------------------------------------------------------------------
// Password reset tokens
// ---------------------------------------------------------------------------

export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  ttlSeconds = 3600,
): Promise<void> {
  await query(
    `insert into auth.password_reset_tokens (user_id, token_hash, expires_at)
     values ($1, $2, now() + ($3 || ' seconds')::interval)`,
    [userId, tokenHash, String(ttlSeconds)],
  );
}

export async function consumePasswordResetToken(
  tokenHash: string,
): Promise<{ userId: string } | null> {
  const rows = await query<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    "select id, user_id, expires_at, used_at from auth.password_reset_tokens where token_hash = $1 limit 1",
    [tokenHash],
  );
  const token = rows[0];
  if (!token) return null;
  if (token.used_at) return null;
  if (new Date(token.expires_at).getTime() < Date.now()) return null;

  await query("update auth.password_reset_tokens set used_at = now() where id = $1", [token.id]);
  return { userId: token.user_id };
}

/** Housekeeping for expired rows — called opportunistically, never on a timer. */
export async function pruneExpiredAuthRows(): Promise<void> {
  await query("delete from auth.sessions where expires_at < now() - interval '7 days'", []);
  await query("delete from auth.password_reset_tokens where expires_at < now() - interval '7 days'", []);
}
