"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { Check, ChevronDown, Globe, LogOut, Sparkles, User } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/lib/i18n/config";
import type { PublicProfile } from "@/lib/db/types";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("common.selectLanguage")}
        className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-2.5 py-2 text-sm font-semibold text-ink-700 hover:border-field-300"
      >
        <Globe className="size-4" aria-hidden />
        <span>{compact ? LOCALE_LABELS[locale].short : LOCALE_LABELS[locale].native}</span>
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg"
          >
            {LOCALES.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={locale === option}
                  onClick={() => {
                    setOpen(false);
                    startTransition(() => setLocale(option as Locale));
                  }}
                  className={clsx(
                    "flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-field-50",
                    locale === option && "font-semibold text-field-800",
                  )}
                >
                  <span>
                    {LOCALE_LABELS[option].native}
                    <span className="ml-1.5 text-xs text-ink-400">{LOCALE_LABELS[option].english}</span>
                  </span>
                  {locale === option ? <Check className="size-4 text-field-600" aria-hidden /> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function SimpleModeToggle({ persistent = false }: { persistent?: boolean }) {
  const { simpleMode, setSimpleMode, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !simpleMode;
    setSimpleMode(next);
    if (persistent) {
      // Persist on the profile too, so the choice follows the user across devices.
      startTransition(async () => {
        await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ simple_mode: next }),
        });
        router.refresh();
      });
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={simpleMode}
      title={t("common.simpleModeHelp")}
      className={clsx(
        "inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-sm font-semibold transition",
        simpleMode
          ? "border-soil-300 bg-soil-100 text-soil-800"
          : "border-ink-200 bg-white text-ink-600 hover:border-field-300",
      )}
    >
      <Sparkles className="size-4" aria-hidden />
      <span className="hidden sm:inline">
        {simpleMode ? t("common.simpleModeOn") : t("common.simpleMode")}
      </span>
      <span className="sm:hidden">{simpleMode ? t("common.simpleMode") : t("common.simpleMode")}</span>
    </button>
  );
}

export function UserMenu({
  profile,
  labels,
}: {
  profile: Pick<PublicProfile, "full_name" | "role" | "avatar_url"> | null;
  labels: { profile: string; logout: string; admin: string; role: string };
}) {
  const [open, setOpen] = useState(false);
  const initial = (profile?.full_name || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-10 place-items-center rounded-full border border-field-200 bg-field-50 text-sm font-bold text-field-800 hover:border-field-400"
        aria-label={labels.profile}
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div role="menu" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg">
            <div className="border-b border-ink-100 px-3.5 py-3">
              <p className="truncate text-sm font-semibold text-ink-900">{profile?.full_name || "—"}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {labels.role}: {profile?.role ?? "—"}
              </p>
            </div>
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3.5 py-2.5 text-sm text-ink-700 hover:bg-field-50"
            >
              <User className="size-4" aria-hidden />
              {labels.profile}
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 border-t border-ink-100 px-3.5 py-2.5 text-left text-sm text-danger-600 hover:bg-danger-50"
              >
                <LogOut className="size-4" aria-hidden />
                {labels.logout}
              </button>
            </form>
          </div>
        </>
      ) : null}
    </div>
  );
}
