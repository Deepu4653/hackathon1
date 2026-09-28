import { cookies } from "next/headers";
import { createTranslator, type Translator } from "@/lib/i18n";
import { LOCALE_COOKIE, toLocale, type Locale } from "@/lib/i18n/config";

/**
 * Resolves the active language and Simple Mode for a request.
 *
 * Simple Mode source of truth is the profile (`profiles.simple_mode`); the cookie
 * mirrors it so the very first paint is already correct. When a profile value is
 * supplied it also refreshes the cookie, keeping both in step.
 */
export async function getTranslatorForRequest(profileSimpleMode?: boolean): Promise<{
  locale: Locale;
  simpleMode: boolean;
  t: Translator;
}> {
  const cookieStore = await cookies();
  const locale = toLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  const cookieSimpleMode = cookieStore.get("xfarm-simple-mode")?.value;
  const simpleMode =
    typeof profileSimpleMode === "boolean" ? profileSimpleMode : cookieSimpleMode === "1";

  if (typeof profileSimpleMode === "boolean" && cookieSimpleMode !== (simpleMode ? "1" : "0")) {
    try {
      cookieStore.set("xfarm-simple-mode", simpleMode ? "1" : "0", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    } catch {
      // Read-only during Server Component render; harmless.
    }
  }

  return { locale, simpleMode, t: createTranslator(locale, simpleMode) };
}
