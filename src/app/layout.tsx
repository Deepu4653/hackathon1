import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { I18nProvider } from "@/lib/i18n/provider";
import { LOCALE_COOKIE, toLocale } from "@/lib/i18n/config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "X-FARM AI — One platform. Every farm need.",
    template: "%s · X-FARM AI",
  },
  description:
    "AI-powered agriculture platform for Indian farmers: weather, crop advice, crop photo checks, soil records, mandi prices and a direct marketplace — in Telugu, Hindi and English.",
  applicationName: "X-FARM AI",
  keywords: ["agriculture", "India", "Andhra Pradesh", "farming", "AI", "mandi prices", "kisan"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#245c30",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = toLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  // Simple Mode is mirrored in a cookie so <html> can be rendered on the very
  // first request without a database round-trip.
  const simpleMode = cookieStore.get("xfarm-simple-mode")?.value === "1";

  return (
    <html
      lang={locale}
      data-simple={simpleMode ? "true" : "false"}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-field-700 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <I18nProvider locale={locale} simpleMode={simpleMode}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
