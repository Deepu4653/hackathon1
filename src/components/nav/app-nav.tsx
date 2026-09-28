"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  Bell,
  Bug,
  CloudSun,
  Heart,
  Home,
  LayoutGrid,
  ListOrdered,
  Map as MapIcon,
  MessageSquare,
  PlusCircle,
  Settings,
  Shield,
  Sprout,
  Store,
  Tractor,
  TrendingUp,
  Wheat,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n";

export interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutGrid, requiresAuth: true },
  { href: "/assistant", labelKey: "nav.assistant", icon: Sparkles, requiresAuth: true },
  { href: "/crop-doctor", labelKey: "nav.cropDoctor", icon: Bug, requiresAuth: true },
  { href: "/weather", labelKey: "nav.weather", icon: CloudSun },
  { href: "/market", labelKey: "nav.market", icon: Store },
  { href: "/market-prices", labelKey: "nav.marketPrices", icon: TrendingUp },
  { href: "/map", labelKey: "nav.map" as TranslationKey, icon: MapIcon },
  { href: "/crops", labelKey: "nav.crops", icon: Wheat, requiresAuth: true },
  { href: "/soil", labelKey: "nav.soil", icon: Sprout, requiresAuth: true },
  { href: "/recommendation", labelKey: "nav.recommend", icon: Tractor, requiresAuth: true },
  { href: "/messages", labelKey: "nav.messages", icon: MessageSquare, requiresAuth: true },
  { href: "/notifications", labelKey: "nav.notifications", icon: Bell, requiresAuth: true },
  { href: "/favorites", labelKey: "nav.favorites", icon: Heart, requiresAuth: true },
];

// The map label lives under "map.title" in the dictionaries.
const EXTRA_LABELS: Partial<Record<string, TranslationKey>> = {
  "/map": "map.title",
  "/market-prices": "nav.marketPrices",
};

export function labelFor(item: NavItem): TranslationKey {
  return EXTRA_LABELS[item.href] ?? item.labelKey;
}

export function SidebarNav({ isAdmin, authenticated }: { isAdmin: boolean; authenticated: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();

  const visible = MAIN_NAV.filter((item) => (item.requiresAuth ? authenticated : true));

  return (
    <nav aria-label={t("nav.menu")} className="space-y-1">
      {visible.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-field-700 text-white shadow-sm" : "text-ink-700 hover:bg-field-50",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            <span className="truncate">{t(labelFor(item))}</span>
          </Link>
        );
      })}

      {authenticated ? (
        <>
          <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {t("nav.more")}
          </div>
          <Link
            href="/listings/new"
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              pathname === "/listings/new" ? "bg-soil-500 text-white" : "text-ink-700 hover:bg-soil-50",
            )}
          >
            <PlusCircle className="size-5 shrink-0" aria-hidden />
            <span>{t("market.create")}</span>
          </Link>
          <Link
            href="/listings/mine"
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              pathname.startsWith("/listings/mine") ? "bg-field-700 text-white" : "text-ink-700 hover:bg-field-50",
            )}
          >
            <ListOrdered className="size-5 shrink-0" aria-hidden />
            <span>{t("market.myListings")}</span>
          </Link>
          <Link
            href="/profile"
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              pathname.startsWith("/profile") ? "bg-field-700 text-white" : "text-ink-700 hover:bg-field-50",
            )}
          >
            <Settings className="size-5 shrink-0" aria-hidden />
            <span>{t("nav.profile")}</span>
          </Link>
          {isAdmin ? (
            <Link
              href="/admin"
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                pathname.startsWith("/admin") ? "bg-ink-800 text-white" : "text-ink-700 hover:bg-ink-100",
              )}
            >
              <Shield className="size-5 shrink-0" aria-hidden />
              <span>{t("nav.admin")}</span>
            </Link>
          ) : null}
        </>
      ) : null}
    </nav>
  );
}

/** Five large, thumb-friendly destinations for phones. */
export function MobileTabBar({
  authenticated,
  unreadMessages,
  unreadNotifications,
  isAdmin,
}: {
  authenticated: boolean;
  unreadMessages: number;
  unreadNotifications: number;
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  const pathname = usePathname();

  const tabs: Array<{
    href: string;
    labelKey: TranslationKey;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = authenticated
    ? [
        { href: "/dashboard", labelKey: "nav.dashboard", icon: Home },
        { href: "/market", labelKey: "nav.market", icon: Store },
        { href: "/assistant", labelKey: "nav.assistant", icon: Sparkles },
        { href: "/messages", labelKey: "nav.messages", icon: MessageSquare, badge: unreadMessages },
        { href: isAdmin ? "/admin" : "/profile", labelKey: isAdmin ? "nav.admin" : "nav.profile", icon: isAdmin ? Shield : Settings },
      ]
    : [
        { href: "/", labelKey: "nav.home", icon: Home },
        { href: "/market", labelKey: "nav.market", icon: Store },
        { href: "/weather", labelKey: "nav.weather", icon: CloudSun },
        { href: "/market-prices", labelKey: "nav.marketPrices", icon: TrendingUp },
        { href: "/login", labelKey: "nav.login", icon: Settings },
      ];

  return (
    <nav
      aria-label={t("nav.menu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[0.68rem] font-medium",
                  active ? "text-field-700" : "text-ink-500",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="max-w-full truncate">{t(tab.labelKey)}</span>
                {tab.badge ? (
                  <span className="absolute right-3 top-1 grid min-w-5 place-items-center rounded-full bg-danger-500 px-1 text-[0.6rem] font-bold text-white">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                ) : null}
                {active ? <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-field-600" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {unreadNotifications > 0 ? (
        <Link
          href="/notifications"
          className="absolute -top-11 right-4 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-2 text-xs font-semibold text-white shadow-lg"
        >
          <Bell className="size-4" aria-hidden />
          {unreadNotifications} {t("notifications.new")}
        </Link>
      ) : null}
    </nav>
  );
}

export function DesktopTopLinks({ authenticated }: { authenticated: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const links = (authenticated
    ? ["/dashboard", "/assistant", "/weather", "/market", "/market-prices", "/map"]
    : ["/market", "/market-prices", "/weather", "/map"]
  )
    .map((href) => MAIN_NAV.find((item) => item.href === href))
    .filter((item): item is NavItem => Boolean(item));

  return (
    <nav aria-label={t("nav.menu")} className="hidden items-center gap-1 lg:flex">
      {links.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-field-50 text-field-800" : "text-ink-600 hover:bg-ink-100",
            )}
          >
            {t(labelFor(item))}
          </Link>
        );
      })}
    </nav>
  );
}
