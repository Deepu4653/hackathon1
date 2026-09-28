"use client";

import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTranslator, type Translator, type TranslationKey } from "@/lib/i18n";
import { LOCALE_COOKIE, SPEECH_TAGS, type Locale } from "./config";

interface I18nContextValue {
  locale: Locale;
  simpleMode: boolean;
  t: Translator;
  speechTag: string;
  setLocale: (locale: Locale) => void;
  setSimpleMode: (simple: boolean) => void;
  isPending: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function writeCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${secure}`;
}

export function I18nProvider({
  locale,
  simpleMode,
  children,
}: {
  locale: Locale;
  simpleMode: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useMemo(() => createTranslator(locale, simpleMode), [locale, simpleMode]);

  const setLocale = useCallback(
    (next: Locale) => {
      writeCookie(LOCALE_COOKIE, next);
      startTransition(() => router.refresh());
    },
    [router],
  );

  const setSimpleMode = useCallback(
    (simple: boolean) => {
      writeCookie("xfarm-simple-mode", simple ? "1" : "0");
      startTransition(() => router.refresh());
    },
    [router],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      simpleMode,
      t,
      speechTag: SPEECH_TAGS[locale],
      setLocale,
      setSimpleMode,
      isPending,
    }),
    [locale, simpleMode, t, setLocale, setSimpleMode, isPending],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return context;
}

/** Convenience hook: const t = useT(); */
export function useT(): Translator {
  return useI18n().t;
}

export type { TranslationKey };
