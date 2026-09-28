/**
 * Session tokens for the local reference runtime.
 *
 * Production uses Supabase Auth. When Supabase is not configured, X-FARM AI
 * issues its own signed access tokens (JWT, HS256) plus opaque refresh tokens
 * stored hashed in PostgreSQL — the same shape Supabase produces, so the rest of
 * the application does not care which one is in play.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { SignJWT, jwtVerify } from "jose";
import { serverEnv } from "@/lib/env.server";

export const ACCESS_COOKIE = "xfarm-access-token";
export const REFRESH_COOKIE = "xfarm-refresh-token";
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

let cachedSecret: Uint8Array | null = null;

/**
 * Signing secret. `LOCAL_AUTH_SECRET` wins when provided; otherwise a random
 * secret is generated once and stored in the (git-ignored) local data directory
 * so sessions survive a dev-server restart. It never leaves the server.
 */
async function getSecret(): Promise<Uint8Array> {
  if (cachedSecret) return cachedSecret;

  if (serverEnv.localAuthSecret) {
    cachedSecret = new TextEncoder().encode(serverEnv.localAuthSecret);
    return cachedSecret;
  }

  const dir = path.resolve(process.cwd(), serverEnv.localDbDir);
  const secretPath = path.join(dir, "local-auth-secret");
  await fs.mkdir(dir, { recursive: true });

  try {
    const existing = (await fs.readFile(secretPath, "utf8")).trim();
    if (existing.length >= 32) {
      cachedSecret = new TextEncoder().encode(existing);
      return cachedSecret;
    }
  } catch {
    /* first run — generate below */
  }

  const generated = crypto.randomBytes(48).toString("base64url");
  await fs.writeFile(secretPath, generated, { mode: 0o600 });
  cachedSecret = new TextEncoder().encode(generated);
  return cachedSecret;
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: "authenticated";
  sessionId: string;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  const secret = await getSecret();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: claims.email, role: claims.role, session_id: claims.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(secret);
}

export interface VerifiedToken {
  sub: string;
  email: string | null;
  sessionId: string | null;
  expired: boolean;
}

export async function verifyAccessToken(token: string): Promise<VerifiedToken | null> {
  const secret = await getSecret();
  try {
    const { payload } = await jwtVerify(token, secret, { audience: "authenticated" });
    return {
      sub: String(payload.sub),
      email: (payload.email as string) ?? null,
      sessionId: (payload.session_id as string) ?? null,
      expired: false,
    };
  } catch (error) {
    // Expired tokens are still useful: the caller can attempt a refresh.
    const message = error instanceof Error ? error.message : "";
    if (message.toLowerCase().includes("expired")) {
      try {
        const decoded = JSON.parse(
          Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
        ) as { sub?: string; email?: string; session_id?: string };
        if (decoded.sub) {
          return {
            sub: decoded.sub,
            email: decoded.email ?? null,
            sessionId: decoded.session_id ?? null,
            expired: true,
          };
        }
      } catch {
        return null;
      }
    }
    return null;
  }
}

export function createOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}
