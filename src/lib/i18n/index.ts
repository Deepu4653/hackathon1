// NOTE: this module is imported by client components, so it must stay free
// of server-only APIs. Request-scoped helpers live in `@/lib/preferences`.
import { DEFAULT_LOCALE, type Locale } from "./config";
import { en, type Dictionary, type TranslationKey } from "./dictionaries/en";
import { te } from "./dictionaries/te";
import { hi } from "./dictionaries/hi";
import { simpleOverrides } from "./simple";

export type { Locale } from "./config";
export { LOCALES, LOCALE_LABELS, SPEECH_TAGS, isLocale, toLocale } from "./config";
export type { TranslationKey } from "./dictionaries/en";

const dictionaries: Record<Locale, Dictionary> = { en, te, hi };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export type Translator = (key: TranslationKey, vars?: Record<string, string | number>) => string;

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] === undefined ? `{${name}}` : String(vars[name]),
  );
}

/** Builds a translator. Missing keys fall back to English, never to a blank label. */
export function createTranslator(locale: Locale, simpleMode = false): Translator {
  const dictionary = getDictionary(locale);
  const overrides = simpleMode ? simpleOverrides[locale] ?? {} : {};

  return (key, vars) => {
    const override = overrides[key];
    const value = override ?? dictionary[key] ?? en[key] ?? String(key);
    return interpolate(value, vars);
  };
}

/** Picks the best catalogue label for the active language. */
export function localisedName(
  row: { name_en: string; name_te?: string | null; name_hi?: string | null },
  locale: Locale,
): string {
  if (locale === "te") return row.name_te || row.name_en;
  if (locale === "hi") return row.name_hi || row.name_en;
  return row.name_en;
}
