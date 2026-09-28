import Link from "next/link";
import { Leaf, Shield } from "lucide-react";
import { getSessionUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { countUnreadMessages, countUnreadNotifications } from "@/lib/repos/messaging";
import { LanguageSwitcher, SimpleModeToggle, UserMenu } from "./nav/controls";
import { DesktopTopLinks, MobileTabBar, SidebarNav } from "./nav/app-nav";

/** Brand block used by every shell. */
export function Brand({ tagline, compact = false }: { tagline: string; compact?: boolean }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="X-FARM AI">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-field-700 text-white">
        <Leaf className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-extrabold leading-tight tracking-tight text-ink-900">
          X-FARM <span className="text-field-700">AI</span>
        </span>
        {!compact ? (
          <span className="block truncate text-[0.7rem] font-medium uppercase tracking-wide text-ink-500">
            {tagline}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * Authenticated shell: sidebar on desktop, bottom tab bar on phones,
 * sticky header with language, Simple Mode, notifications and account menu.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const { locale, t, simpleMode } = await getTranslatorForRequest(user?.profile.simple_mode);
  const isAdmin = user?.profile.role === "admin";

  const [unreadMessages, unreadNotifications] = user
    ? await Promise.all([countUnreadMessages(user.id), countUnreadNotifications(user.id)])
    : [0, 0];

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2.5 sm:px-5">
          <Brand tagline={t("app.tagline")} compact />
          <DesktopTopLinks authenticated={Boolean(user)} />
          <div className="ml-auto flex items-center gap-2">
            <SimpleModeToggle persistent />
            <LanguageSwitcher compact />
            {user ? (
              <>
                <Link
                  href="/notifications"
                  aria-label={t("notifications.title")}
                  className="relative grid size-10 place-items-center rounded-xl border border-ink-200 bg-white text-ink-600 hover:border-field-300"
                >
                  <Leaf className="hidden size-4" aria-hidden />
                  <span className="text-lg leading-none" aria-hidden>
                    🔔
                  </span>
                  {unreadNotifications > 0 ? (
                    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-danger-500 px-1 text-[0.6rem] font-bold text-white">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  ) : null}
                </Link>
                <UserMenu
                  profile={user.profile}
                  labels={{
                    profile: t("nav.profile"),
                    logout: t("nav.logout"),
                    admin: t("nav.admin"),
                    role: t("admin.role"),
                  }}
                />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-field-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-field-800"
                >
                  {t("nav.signup")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-3 pb-24 pt-4 sm:px-5 md:pb-8">
        {user ? (
          <aside className="hidden w-60 shrink-0 md:block">
            <div className="sticky top-20 rounded-[var(--radius-card)] border border-ink-200 bg-white p-2.5 shadow-[var(--shadow-card)]">
              <SidebarNav isAdmin={isAdmin} authenticated />
              {isAdmin ? (
                <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-ink-100 px-3 py-2 text-xs font-medium text-ink-600">
                  <Shield className="size-3.5" aria-hidden />
                  {t("auth.adminOnly")}
                </p>
              ) : null}
            </div>
          </aside>
        ) : null}

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>

      <MobileTabBar
        authenticated={Boolean(user)}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications}
        isAdmin={isAdmin}
      />
      {simpleMode ? <span className="sr-only">{t("common.simpleModeOn")}</span> : null}
      <span className="sr-only">{locale}</span>
    </div>
  );
}

/** Lightweight shell for public pages (landing, market, weather, auth). */
export async function PublicShell({ children }: { children: React.ReactNode }) {
  const { t } = await getTranslatorForRequest();
  const user = await getSessionUser().catch(() => null);

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-5">
          <Brand tagline={t("app.tagline")} />
          <div className="ml-auto flex items-center gap-2">
            <SimpleModeToggle persistent={Boolean(user)} />
            <LanguageSwitcher compact />
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-xl bg-field-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-field-800"
              >
                {t("nav.dashboard")}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100 sm:block"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-field-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-field-800"
                >
                  {t("nav.signup")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-3 pb-24 pt-5 sm:px-5 md:pb-10">
        {children}
      </main>
      <MobileTabBar
        authenticated={Boolean(user)}
        unreadMessages={0}
        unreadNotifications={0}
        isAdmin={false}
      />
      <footer className="border-t border-ink-200 bg-white py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <strong className="text-ink-700">X-FARM AI</strong> · {t("app.tagline")}
          </p>
          <p className="text-xs">
            {t("weather.dataSource")} · {t("prices.sourceNote")}
          </p>
        </div>
      </footer>
    </div>
  );
}
