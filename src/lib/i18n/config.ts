export const LOCALES = ["en", "te", "hi"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "xfarm-locale";

export const LOCALE_LABELS: Record<Locale, { native: string; english: string; short: string }> = {
  en: { native: "English", english: "English", short: "EN" },
  te: { native: "తెలుగు", english: "Telugu", short: "తె" },
  hi: { native: "हिन्दी", english: "Hindi", short: "हि" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: unknown, fallback: Locale = DEFAULT_LOCALE): Locale {
  return isLocale(value) ? value : fallback;
}

/** Speech-recognition / speech-synthesis language tags. */
export const SPEECH_TAGS: Record<Locale, string> = {
  en: "en-IN",
  te: "te-IN",
  hi: "hi-IN",
};
