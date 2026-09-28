/** Tiny indirection so `mail.ts` stays free of Next-runtime imports. */
import { serverEnv } from "@/lib/env.server";

export { serverEnv };

export function publicEnvFallbackAppUrl(): string {
  const url = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
  return url.replace(/\/$/, "");
}

/** True only when an SMTP relay is actually configured for this deployment. */
export function isMailConfigured(): boolean {
  return Boolean(serverEnv.smtpUrl);
}
