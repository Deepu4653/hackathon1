import { AppShell } from "@/components/app-shell";

/**
 * Authenticated area. Middleware already blocks anonymous visitors; this layout
 * performs the authoritative check inside `AppShell` via `getSessionUser()`
 * (which is also where role-based redirects happen for admin routes).
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
