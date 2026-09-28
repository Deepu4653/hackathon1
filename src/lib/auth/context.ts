/**
 * Resolves the security context for data access.
 *
 * Supabase mode  → RLS with the cookie-bound Supabase client (this module is only
 *                  used for diagnostics and for the local storage driver).
 * Local mode     → the verified session cookie is turned into an AuthContext that
 *                  the local engine replays as role + JWT claims, so RLS still
 *                  decides what SQL may read or write.
 */

import { cookies, headers } from "next/headers";
import { isHttpsRequest } from "./cookie-scheme";
import { dataBackend } from "@/lib/env";
import { anonContext, userContext, type AuthContext } from "@/lib/db/local/auth-context";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  createOpaqueToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from "./tokens";
import {
  findSessionByRefreshToken,
  findUserById,
  isSessionLive,
  rotateSessionRefreshToken,
} from "./local-store";

export interface ResolvedSession {
  userId: string;
  email: string | null;
  sessionId: string;
}

/**
 * Attributes for the session cookies.
 *
 * `Secure` follows the ACTUAL request scheme — never `NODE_ENV` alone. A
 * production build served over plain HTTP (`next start` on
 * http://localhost:3000, or a proxy that terminates TLS without forwarding the
 * scheme) must still be able to store the session: a Secure cookie over http is
 * discarded by the browser, so signing in appears to work (the action's own
 * response renders the dashboard) and then every later click bounces back to
 * /login.
 */
async function cookieOptions(maxAge: number) {
  const headerList = await headers();
  const secure = isHttpsRequest({
    forwardedProto: headerList.get("x-forwarded-proto"),
    host: headerList.get("host"),
    extraHints: [headerList.get("forwarded"), headerList.get("x-forwarded-ssl"), headerList.get("front-end-https")],
  });

  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

/** Writes session cookies. Only valid inside a Server Action / Route Handler. */
export async function writeSessionCookies(
  userId: string,
  email: string | null,
  sessionId: string,
  refreshToken: string,
): Promise<void> {
  const cookieStore = await cookies();
  const accessToken = await signAccessToken({
    sub: userId,
    email: email ?? "",
    role: "authenticated",
    sessionId,
  });
  const options = await cookieOptions(ACCESS_TOKEN_TTL_SECONDS);
  cookieStore.set(ACCESS_COOKIE, accessToken, options);
  cookieStore.set(REFRESH_COOKIE, refreshToken, { ...options, maxAge: REFRESH_TOKEN_TTL_SECONDS });
}

export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  const options = await cookieOptions(0);
  cookieStore.set(ACCESS_COOKIE, "", options);
  cookieStore.set(REFRESH_COOKIE, "", options);
}

/**
 * Reads the current session.
 * - Valid access token → done.
 * - Expired access token + valid refresh token → session is refreshed (rotation)
 *   and new cookies are written when the runtime allows it.
 */
export async function getResolvedSession(): Promise<ResolvedSession | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    const verified = await verifyAccessToken(accessToken);
    if (verified && !verified.expired && (await isSessionLive(verified.sessionId ?? ""))) {
      return { userId: verified.sub, email: verified.email, sessionId: verified.sessionId ?? "" };
    }
  }

  if (!refreshToken) return null;

  const session = await findSessionByRefreshToken(refreshToken);
  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const user = await findUserById(session.user_id);
  if (!user) return null;
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) return null;

  const rotated = createOpaqueToken();
  await rotateSessionRefreshToken(session.id, rotated, REFRESH_TOKEN_TTL_SECONDS);
  try {
    await writeSessionCookies(user.id, user.email, session.id, rotated);
  } catch {
    // Rendering a Server Component: cookies are read-only. The refreshed
    // session is still valid for this request and will be persisted by the next
    // Server Action, giving "persistent sessions" without a crash.
  }

  return { userId: user.id, email: user.email, sessionId: session.id };
}

export async function getLocalAuthContext(): Promise<AuthContext> {
  const session = await getResolvedSession();
  if (!session) return anonContext;
  return userContext(session.userId, session.email);
}

export async function currentRequestUserAgent(): Promise<{ userAgent: string | null; ip: string | null }> {
  const headerList = await headers();
  return {
    userAgent: headerList.get("user-agent"),
    ip:
      headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      headerList.get("x-real-ip") ??
      null,
  };
}

export { dataBackend, hashToken };
