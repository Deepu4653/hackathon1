/**
 * Server-only environment configuration.
 *
 * Importing this file from a client component throws, so secrets can never end
 * up in the browser bundle. Next.js also strips non-`NEXT_PUBLIC_` variables
 * from client bundles; this guard makes the mistake loud during development.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "src/lib/env.server.ts must never be imported into client-side code (it reads server secrets).",
  );
}

const clean = (value: string | undefined) => (value ?? "").trim();

export const serverEnv = {
  /** Gemini (Google AI Studio) */
  geminiApiKey: clean(process.env.GEMINI_API_KEY),
  geminiModel: clean(process.env.GEMINI_MODEL) || "gemini-2.5-flash",
  geminiVisionModel: clean(process.env.GEMINI_VISION_MODEL) || clean(process.env.GEMINI_MODEL) || "gemini-2.5-flash",
  geminiApiBase: clean(process.env.GEMINI_API_BASE) || "https://generativelanguage.googleapis.com/v1beta",

  /** Supabase service role — server only, never sent to the browser. */
  supabaseServiceRoleKey: clean(process.env.SUPABASE_SERVICE_ROLE_KEY),

  /** data.gov.in (Agmarknet mandi prices) */
  dataGovApiKey: clean(process.env.DATA_GOV_IN_API_KEY),
  dataGovResourceId: clean(process.env.DATA_GOV_MANDI_RESOURCE_ID) || "9ef84268-d588-465a-a308-a864a43d0070",

  /** Local runtime */
  /**
   * Data directory of the local PostgreSQL engine.
   *
   * Read lazily on purpose: CLI scripts (migrations, seeds, tests) choose their
   * own directory by setting `LOCAL_DB_DIR` at startup, and they must be able to
   * point at a scratch database instead of the one a running dev server holds
   * open. Two PostgreSQL processes on one data directory corrupt it, so keeping
   * this switchable is a safety feature, not a convenience.
   */
  get localDbDir(): string {
    return clean(process.env.LOCAL_DB_DIR) || ".data/pglite";
  },
  localAuthSecret: clean(process.env.LOCAL_AUTH_SECRET),
  storageDriver: (clean(process.env.STORAGE_DRIVER) || "auto").toLowerCase(),
  adminEmails: clean(process.env.ADMIN_EMAILS)
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  mailFrom: clean(process.env.MAIL_FROM) || "X-FARM AI <no-reply@xfarm.ai>",
  smtpUrl: clean(process.env.SMTP_URL),
  allowDevResetLink: /^(1|true|yes|on)$/i.test(clean(process.env.ALLOW_DEV_RESET_LINK)),
} as const;

/** Which optional integrations are usable right now. */
export const integrationStatus = {
  gemini: Boolean(serverEnv.geminiApiKey),
  supabaseServiceRole: Boolean(serverEnv.supabaseServiceRoleKey),
  dataGov: Boolean(serverEnv.dataGovApiKey),
} as const;

export function requireEnv(name: keyof typeof serverEnv): string {
  const value = serverEnv[name];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
