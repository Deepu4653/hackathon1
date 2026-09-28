/**
 * Is this request travelling over HTTPS?
 *
 * Session cookies must carry `Secure` on HTTPS and must NOT carry it on plain
 * HTTP: a browser silently discards a Secure cookie that arrives over http, so
 * the visitor appears to sign in (the server action's own response renders the
 * dashboard) and is then bounced to /login on the very next click.
 *
 * `NODE_ENV` is not a substitute for the real scheme — a production build is
 * routinely served over http://localhost:3000, and a proxy may terminate TLS
 * without the app ever seeing an https URL. Order of truth:
 *   1. `x-forwarded-proto` (first value), when a proxy sets it,
 *   2. an explicit protocol, when the caller has one (middleware),
 *   3. loopback hosts are http,
 *   4. otherwise assume https in production, http in development.
 */
export function isHttpsRequest(input: {
  forwardedProto?: string | null;
  host?: string | null;
  protocol?: string | null;
  /** Any other proxy hints the caller can supply (`forwarded`, `x-forwarded-ssl`, …). */
  extraHints?: Array<string | null | undefined>;
}): boolean {
  const forwarded = input.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;

  // Other common edge-proxy hints, in the same trust order.
  for (const hint of input.extraHints ?? []) {
    const value = hint?.toLowerCase().trim();
    if (!value) continue;
    if (/^(https|on|1|true)\b/.test(value) || value.includes("proto=https")) return true;
    if (/^(http|off|0|false)\b/.test(value) || value.includes("proto=http")) return false;
  }

  const host = (input.host ?? "").toLowerCase();
  if (/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/.test(host)) return false;

  if (input.protocol) return input.protocol === "https:";
  return process.env.NODE_ENV === "production";
}
