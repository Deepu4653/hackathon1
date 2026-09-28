import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { dataBackend, publicEnv } from "@/lib/env";
import { isHttpsRequest } from "@/lib/auth/cookie-scheme";

/**
 * Route protection.
 *
 * Two layers, deliberately:
 *   1. Middleware (here) — cheap gate: does the visitor have a session at all?
 *      It also refreshes Supabase sessions so Server Components always read a
 *      live cookie.
 *   2. Server-side authorisation in layouts/pages (`requireUser`, `requireAdmin`)
 *      — the real check, always performed against the database. Role checks are
 *      NEVER trusted to middleware or the client.
 */

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/assistant",
  "/crop-doctor",
  "/recommendation",
  "/crops",
  "/farms",
  "/soil",
  "/messages",
  "/notifications",
  "/map",
  "/market-prices",
  "/favorites",
  "/profile",
  "/listings/new",
  "/listings/mine",
  "/admin",
];

const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let response = NextResponse.next({ request });
  let authenticated: boolean;

  // Same scheme rule as the app's own session cookies: Secure only on HTTPS.
  const secureCookies = isHttpsRequest({
    forwardedProto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host"),
    protocol: request.nextUrl.protocol,
    extraHints: [
      request.headers.get("forwarded"),
      request.headers.get("x-forwarded-ssl"),
      request.headers.get("front-end-https"),
    ],
  });

  // Which backend is in force — not simply "are credentials present". A
  // deployment can hold Supabase credentials while running the local
  // PostgreSQL fallback (DATA_BACKEND=local); sessions must then be read from
  // this app's own cookies, or every signed-in visitor would be logged out.
  if (dataBackend() === "supabase") {
    const supabase = createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, { ...options, secure: secureCookies });
          }
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    authenticated = Boolean(data.user);
  } else {
    const access = request.cookies.get("xfarm-access-token")?.value;
    const refresh = request.cookies.get("xfarm-refresh-token")?.value;
    authenticated = Boolean(access || refresh);
  }

  if (isProtected(pathname) && !authenticated) {
    // `welcome=1` means a successful sign-in redirected here, so an unauthenticated
    // arrival at that moment is the "browser dropped the session cookie" case —
    // worth explaining on the login page instead of bouncing silently.
    const cookieDropped = request.nextUrl.searchParams.get("welcome") === "1";
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}${cookieDropped ? "&cookie=blocked" : ""}`;
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/storage|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)"],
};
