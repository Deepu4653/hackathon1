/**
 * End-to-end flow test.
 *
 *   npm run build && npm run test:flow
 *
 * This is the closest thing to "a person using the application", and it is
 * fully self-contained: it builds nothing, starts its own copy of the
 * production server on port 3100 with its own database directory
 * (`.data/flow-db`), then talks to that server over HTTP exactly like a browser.
 *
 *   · creates three real accounts (farmer, buyer, admin) and keeps their real
 *     session cookies,
 *   · writes a farm, a marketplace listing, a favourite and a conversation —
 *     through the server, so real validation, constraints and RLS apply,
 *   · loads every screen as those users and asserts they render with no stack
 *     trace and no invented value,
 *   · asserts role boundaries (a farmer never reaches /admin) and that signing
 *     out really ends the session.
 *
 * Fixture rows are created by the server itself (see `src/app/api/test-fixtures`),
 * because the local PostgreSQL engine is single-connection: a test process and
 * the server it tests cannot share one data directory. That route answers 404
 * unless the runner supplies `X_FARM_ALLOW_TEST_FIXTURES=1` and a matching
 * `X_FARM_FIXTURE_TOKEN` here, and it is disabled on any Supabase deployment.
 *
 * To run against a server you started yourself:
 *   TEST_BASE_URL=https://… X_FARM_ALLOW_TEST_FIXTURES=1 X_FARM_FIXTURE_TOKEN=… npm run test:flow
 */
import "./env";

import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const attachedBaseUrl = process.env.TEST_BASE_URL?.replace(/\/$/, "") ?? null;
const FLOW_PORT = Number(process.env.TEST_FLOW_PORT ?? 3100);
const baseUrl = attachedBaseUrl ?? `http://127.0.0.1:${FLOW_PORT}`;
const fixtureToken =
  process.env.X_FARM_FIXTURE_TOKEN && process.env.TEST_BASE_URL
    ? process.env.X_FARM_FIXTURE_TOKEN
    : crypto.randomBytes(24).toString("base64url");

let server: ChildProcess | null = null;
let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function hasProductionBuild(): boolean {
  return fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"));
}

async function serverIsUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) });
    return response.status === 200 || response.status === 503;
  } catch {
    return false;
  }
}

async function startServer(): Promise<boolean> {
  // Refuse to run against a server this script did not start: a leftover
  // process from an earlier run would answer the health check and then fail
  // every fixture call in a very confusing way.
  if (await serverIsUp(baseUrl)) {
    console.error(
      `  ✗ something is already listening on ${baseUrl}. Stop it, or use TEST_FLOW_PORT=<port>.`,
    );
    return false;
  }

  // The local `next` binary directly (no `npx` wrapper): the wrapper's child
  // would otherwise survive the kill and keep holding the port.
  const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
  server = spawn(nextBin, ["start", "-H", "127.0.0.1", "-p", String(FLOW_PORT)], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      LOCAL_DB_DIR: ".data/flow-db",
      X_FARM_ALLOW_TEST_FIXTURES: "1",
      X_FARM_FIXTURE_TOKEN: fixtureToken,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await serverIsUp(baseUrl)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function stopServer() {
  if (!server?.pid) return;
  try {
    // The whole process group, so no orphaned server keeps the port.
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  server = null;
}

/** Calls the fixture harness; returns the parsed body and any session cookie. */
async function fixture(
  body: Record<string, unknown>,
  cookie?: string,
): Promise<{ status: number; json: Record<string, unknown>; cookie: string }> {
  const response = await fetch(`${baseUrl}/api/test-fixtures`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fixture-token": fixtureToken,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const pair = setCookie.map((value) => value.split(";")[0]).join("; ");
  return { status: response.status, json, cookie: pair };
}

async function visit(pathname: string, cookie?: string) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
  const html = await response.text();
  return { status: response.status, location: response.headers.get("location") ?? "", html };
}

/** A raw translation key leaking into the page means a missing dictionary entry. */
const RAW_KEY = new RegExp(
  String.raw`\b(?:home|market|soil|recommend|crops|admin|weather|ai|doctor|prices|messages|notifications|profile|common|auth|nav|dash|map|farms|favorites|listings|simple|home)\.` +
    String.raw`(?:role|status|type|season|hint|water|suitability|reportReason|kind|source)\.[a-z_]+`,
);

function looksClean(html: string): boolean {
  return (
    !html.includes("Application error") &&
    !html.includes("Unhandled Runtime Error") &&
    !html.includes("TypeError:") &&
    !/at Object\.\w+ \(/.test(html)
  );
}

async function main() {
  console.log(`X-FARM AI end-to-end flow → ${baseUrl}\n`);

  if (!attachedBaseUrl) {
    if (!hasProductionBuild()) {
      console.error("  ✗ no production build found — run `npm run build` first");
      process.exitCode = 1;
      return;
    }
    console.log(`Starting a private production server on port ${FLOW_PORT}…`);
    if (!(await startServer())) {
      console.error("  ✗ the test server did not become ready in time");
      stopServer();
      process.exitCode = 1;
      return;
    }
    console.log("Server ready.\n");
  }

  console.log("Accounts (real sign-up path, real session cookies)");
  const reset = await fixture({ action: "reset" });
  check("fixture harness is reachable and reset the disposable accounts", reset.status === 200, `status ${reset.status}`);

  const farmer = await fixture({ action: "account", email: "flow.farmer@example.com", role: "farmer", fullName: "Flow Farmer", simpleMode: true });
  const buyer = await fixture({ action: "account", email: "flow.buyer@example.com", role: "buyer", fullName: "Flow Buyer" });
  const admin = await fixture({ action: "account", email: "flow.admin@example.com", role: "admin", fullName: "Flow Admin" });
  check("farmer account created and signed in", farmer.json.ok === true && farmer.cookie.length > 0, String(farmer.json.error ?? ""));
  check("buyer account created and signed in", buyer.json.ok === true && buyer.cookie.length > 0, String(buyer.json.error ?? ""));
  check("admin account created (ADMIN_EMAILS-style promotion) and signed in", admin.json.ok === true && admin.cookie.length > 0, String(admin.json.error ?? ""));

  console.log("\nData written through the server, as those users");
  const farm = await fixture({ action: "farm", farmName: "Flow test farm" }, farmer.cookie);
  check("farmer created a farm", farm.json.ok === true, String(farm.json.error ?? ""));

  const listing = await fixture({ action: "listing", listingTitle: "Flow test paddy, 20 quintals" }, farmer.cookie);
  const listingId = typeof listing.json.id === "string" ? listing.json.id : null;
  check("farmer published a marketplace listing", listing.json.ok === true && Boolean(listingId), String(listing.json.error ?? ""));

  if (listingId) {
    const favorite = await fixture({ action: "favorite", listingId }, buyer.cookie);
    check("buyer saved the listing to favourites", favorite.json.ok === true, String(favorite.json.error ?? ""));

    const conversation = await fixture({ action: "conversation", listingId }, buyer.cookie);
    check("buyer started a conversation with the seller", conversation.json.ok === true, String(conversation.json.error ?? ""));

    const inspected = await fixture({ action: "inspect" });
    const counts = (inspected.json.counts ?? {}) as Record<string, number>;
    check("the profile rows were created by the sign-up trigger", (counts.profiles ?? 0) >= 3, JSON.stringify(counts));
    check("the listing is stored", (counts.listings ?? 0) >= 1, JSON.stringify(counts));
    check("the farm is stored", (counts.farms ?? 0) >= 1, JSON.stringify(counts));
    check("the favourite is stored for the buyer only", (counts.favorites ?? 0) === 1, JSON.stringify(counts));
    check("the conversation and its messages are stored", (counts.messages ?? 0) >= 2, JSON.stringify(counts));
    check(
      "the seller received a server-side message notification",
      (counts.notifications ?? 0) >= 1,
      JSON.stringify(counts),
    );
  }

  console.log("\nFarmer screens (Simple Mode on the profile)");
  const farmerPages = [
    "/dashboard",
    "/farms",
    "/crops",
    "/soil",
    "/weather",
    "/market",
    "/messages",
    "/notifications",
    "/favorites",
    "/profile",
    "/assistant",
    "/crop-doctor",
    "/recommendation",
    "/map",
    "/market-prices",
    "/listings/new",
    "/listings/mine",
  ];
  for (const pathname of farmerPages) {
    const page = await visit(pathname, farmer.cookie);
    check(`GET ${pathname} → 200`, page.status === 200, `status ${page.status}`);
    if (page.status !== 200) continue;
    check(`GET ${pathname} renders without an error trace`, looksClean(page.html));
    const leaked = page.html.match(RAW_KEY);
    check(`GET ${pathname} shows no untranslated key`, leaked === null, leaked ? leaked[0] : undefined);
  }

  if (listingId) {
    const detail = await visit(`/market/${listingId}`, farmer.cookie);
    check("GET /market/[id] → 200", detail.status === 200, `status ${detail.status}`);
    check("the listing detail shows the real title", detail.html.includes("Flow test paddy"));
  }

  // Which honest behaviour is correct depends on whether a Gemini key exists —
  // both branches are checked, so this stays meaningful with or without one.
  const geminiConfigured = Boolean((process.env.GEMINI_API_KEY ?? "").trim());
  console.log(
    `\nHonest AI states (GEMINI_API_KEY ${geminiConfigured ? "configured" : "not configured"})`,
  );
  const assistant = await visit("/assistant", farmer.cookie);
  check(
    geminiConfigured
      ? "assistant says Gemini is configured instead of pretending it is absent"
      : "assistant names the missing GEMINI_API_KEY instead of inventing an answer",
    geminiConfigured ? assistant.html.includes("Gemini is configured") : assistant.html.includes("GEMINI_API_KEY"),
  );
  check(
    "assistant shows an empty state, never a pre-filled answer",
    assistant.html.includes("Ask your first question") || assistant.html.includes("Previous chats"),
  );

  const doctor = await visit("/crop-doctor", farmer.cookie);
  check(
    geminiConfigured
      ? "crop doctor shows no diagnosis before a photo is uploaded"
      : "crop doctor refuses to analyse without the vision model configured",
    geminiConfigured
      ? doctor.html.includes("Check this photo") && !doctor.html.includes("Possible problem")
      : doctor.html.includes("GEMINI_API_KEY") || doctor.html.includes("not available") || doctor.html.includes("not configured"),
  );
  const prices = await visit("/market-prices", farmer.cookie);
  check(
    "market prices never show invented numbers",
    prices.html.includes("No sourced price rows") || prices.html.includes("Real data only"),
  );

  console.log("\nSigning in from a real browser (form replay)");
  // The fixture route mints sessions directly, so it can never catch a cookie
  // that a browser would refuse to store. This replays the actual login form.
  const loginPage = await visit("/login");
  const actionFields = [...loginPage.html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)]
    .map((match) => match[0])
    .map((tag) => ({
      name: /name="([^"]*)"/.exec(tag)?.[1] ?? "",
      value: (/value="([^"]*)"/.exec(tag)?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
    }))
    .filter((field) => field.name.startsWith("$ACTION"));
  check("the login form exposes its server-action fields", actionFields.length > 0, `${actionFields.length} fields`);

  const submitLogin = async (headers: Record<string, string> = {}) => {
    const form = new FormData();
    for (const field of actionFields) form.append(field.name, field.value);
    form.append("email", "flow.farmer@example.com");
    form.append("password", "FlowTest!2026");
    const response = await fetch(`${baseUrl}/login`, { method: "POST", body: form, redirect: "manual", headers });
    const cookies = response.headers.getSetCookie?.() ?? [];
    return { status: response.status, cookies, session: cookies.find((cookie) => cookie.startsWith("xfarm-access-token=")) };
  };

  const direct = await submitLogin();
  check("POST /login answers with a redirect", [302, 303, 307].includes(direct.status), `status ${direct.status}`);
  check("…and sets a session cookie", Boolean(direct.session));
  check(
    "…without Secure on plain HTTP (a Secure cookie over http is silently dropped)",
    Boolean(direct.session) && !/;\s*Secure/i.test(direct.session as string),
    direct.session ? direct.session.split(";").slice(1).join(";").trim() : "no cookie",
  );

  const jar = direct.cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  const afterLogin = await visit("/dashboard", jar);
  check("the cookie the browser would store opens the dashboard", afterLogin.status === 200, `status ${afterLogin.status}`);
  const nextClick = await visit("/messages", jar);
  check("…and the session survives the next click", nextClick.status === 200, `status ${nextClick.status}`);

  const bounced = await visit("/dashboard?welcome=1");
  check(
    "a signed-in visitor whose cookie was dropped is told why",
    bounced.status !== 200 && bounced.location.includes("cookie=blocked"),
    `status ${bounced.status} location ${bounced.location}`,
  );
  const explained = await visit("/login?next=%2Fdashboard&cookie=blocked");
  check(
    "…and the login page explains the dropped cookie",
    explained.html.includes("did not keep the sign-in cookie"),
  );

  const proxied = await submitLogin({ "x-forwarded-proto": "https" });
  check(
    "behind an HTTPS proxy the session cookie is Secure",
    Boolean(proxied.session) && /;\s*Secure/i.test(proxied.session as string),
    proxied.session ? proxied.session.split(";").slice(1).join(";").trim() : "no cookie",
  );

  console.log("\nUnread message badges");

  /** The badge rendered next to the /messages link (mobile tab bar is last). */
  const messagesBadge = (html: string): number => {
    const at = html.lastIndexOf('href="/messages"');
    if (at === -1) return 0;
    const slice = html.slice(at, at + 1200);
    const match = /rounded-full[^>]*>\s*(\d{1,3})\s*</.exec(slice);
    return match ? Number(match[1]) : 0;
  };

  // The buyer wrote two messages and has received none: their own words must
  // never badge their inbox. The farmer received both and must see "2".
  const buyerDashboard = await visit("/dashboard", buyer.cookie);
  check(
    "a buyer who only sent messages has no unread badge",
    messagesBadge(buyerDashboard.html) === 0,
    `badge ${messagesBadge(buyerDashboard.html)}`,
  );
  const farmerDashboard = await visit("/dashboard", farmer.cookie);
  check(
    "the farmer who received them sees 2 unread",
    messagesBadge(farmerDashboard.html) === 2,
    `badge ${messagesBadge(farmerDashboard.html)}`,
  );

  console.log("\nLanguage reaches the browser tab");
  const teluguDash = await visit("/dashboard", `${farmer.cookie}; xfarm-locale=te`);
  const teluguTitle = /<title>([^<]*)<\/title>/.exec(teluguDash.html)?.[1] ?? "";
  check(
    "the Telugu dashboard has a Telugu <title>",
    teluguTitle.length > 0 && !/^Dashboard/.test(teluguTitle),
    `title ${JSON.stringify(teluguTitle)}`,
  );
  const hindiMarket = await visit("/market", `${buyer.cookie}; xfarm-locale=hi`);
  const hindiTitle = /<title>([^<]*)<\/title>/.exec(hindiMarket.html)?.[1] ?? "";
  check(
    "the Hindi marketplace has a Hindi <title>",
    hindiTitle.length > 0 && hindiTitle !== "Marketplace · X-FARM AI",
    `title ${JSON.stringify(hindiTitle)}`,
  );

  console.log("\nPublic pages (anonymous visitor)");
  for (const pathname of ["/", "/login", "/signup", "/market"]) {
    const page = await visit(pathname);
    check(`GET ${pathname} → 200 anonymously`, page.status === 200, `status ${page.status}`);
    const leaked = page.html.match(RAW_KEY);
    check(`GET ${pathname} shows no untranslated key`, leaked === null, leaked ? leaked[0] : undefined);
  }

  console.log("\nRole boundaries");
  for (const pathname of ["/admin", "/admin/users", "/admin/listings", "/admin/reports", "/admin/categories"]) {
    const page = await visit(pathname, farmer.cookie);
    check(
      `farmer is kept out of ${pathname}`,
      page.status !== 200 && (page.location.includes("/dashboard") || page.location.includes("/login")),
      `status ${page.status} location ${page.location}`,
    );
  }

  console.log("\nAdministrator screens");
  for (const pathname of ["/admin", "/admin/users", "/admin/listings", "/admin/reports", "/admin/categories"]) {
    const page = await visit(pathname, admin.cookie);
    check(`GET ${pathname} → 200 as admin`, page.status === 200, `status ${page.status}`);
    if (page.status === 200) {
      check(`GET ${pathname} renders without an error trace`, looksClean(page.html));
      const leaked = page.html.match(RAW_KEY);
      check(`GET ${pathname} shows no untranslated key`, leaked === null, leaked ? leaked[0] : undefined);
    }
  }

  console.log("\nSessions end when they should");
  const signedOut = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    redirect: "manual",
    headers: { cookie: farmer.cookie },
  });
  check(
    "POST /api/auth/logout redirects",
    [302, 303, 307].includes(signedOut.status),
    `status ${signedOut.status}`,
  );
  const afterSignOut = await visit("/dashboard", farmer.cookie);
  check("a revoked session no longer opens protected pages", afterSignOut.status !== 200, `status ${afterSignOut.status}`);

  const anonymousAdmin = await visit("/admin");
  check("an anonymous visitor cannot reach the admin dashboard", anonymousAdmin.status !== 200, `status ${anonymousAdmin.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("[test:flow] crashed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    stopServer();
  });
