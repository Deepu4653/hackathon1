import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createTranslator, type TranslationKey } from ".";
import { LOCALE_COOKIE, toLocale } from "./config";

/**
 * Localised `<title>` for a page.
 *
 * The browser tab, history and bookmarks are part of the interface, so they
 * follow the same language as the page: in Telugu mode /weather is
 * "వాతావరణం · X-FARM AI", not "Weather · X-FARM AI". The locale comes from the
 * same cookie `getTranslatorForRequest()` reads, so the two can never disagree.
 */
export function pageMetadata(key: TranslationKey): () => Promise<Metadata> {
  return async () => {
    const cookieStore = await cookies();
    const locale = toLocale(cookieStore.get(LOCALE_COOKIE)?.value);
    return { title: createTranslator(locale)(key) };
  };
}
