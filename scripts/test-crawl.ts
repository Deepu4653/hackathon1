/**
 * Crawl test: every page, every role, every link, plus hostile query strings.
 *
 *   npm run build && npm run test:crawl
 *
 * Starts a private production server on its own database (`.data/crawl-db`) with
 * the fixture harness enabled, creates three real accounts through the server,
 * then walks the whole application:
 *
 *   · loads every route as farmer / buyer / admin / anonymous and fails on a
 *     status other than the expected one,
 *   · follows every internal link found in those pages and fails on a dead one,
 *   · scans the VISIBLE text (scripts stripped, so the RSC payload's own
 *     "undefined" strings do not matter) for undefined / NaN / Infinity /
 *     Invalid Date / [object Object] / raw translation keys / empty hrefs,
 *   · fires junk and hostile query strings at the public pages and APIs
 *     (`?page=abc`, `?page=9999`, `?q=%`, search-injection attempts).
 *
 * It never writes fixtures the application could not write itself: every row
 * goes through the same repositories, validation and RLS the UI uses.
 */
import "./env";

import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import path from "node:path";

const PORT = Number(process.env.TEST_CRAWL_PORT ?? 3200);
const baseUrl = `http://127.0.0.1:${PORT}`;
const fixtureToken = crypto.randomBytes(24).toString("base64url");

let server: ChildProcess | null = null;
const issues: string[] = [];

function report(kind: string, where: string, detail: string) {
  issues.push(`${kind} · ${where} · ${detail}`);
  console.log(`  ✗ [${kind}] ${where} — ${detail}`);
}

function ok(label: string) {
  console.log(`  ✓ ${label}`);
}

async function serverIsUp(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
    return response.status === 200 || response.status === 503;
  } catch {
    return false;
  }
}

async function startServer(): Promise<boolean> {
  const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
  server = spawn(nextBin, ["start", "-H", "127.0.0.1", "-p", String(PORT)], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      LOCAL_DB_DIR: ".data/crawl-db",
      X_FARM_ALLOW_TEST_FIXTURES: "1",
      X_FARM_FIXTURE_TOKEN: fixtureToken,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await serverIsUp()) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

function stopServer() {
  if (!server?.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
  server = null;
}

async function fixture(body: Record<string, unknown>, cookie?: string) {
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
  const pair = (response.headers.getSetCookie?.() ?? []).map((value) => value.split(";")[0]).join("; ");
  return { status: response.status, json, cookie: pair };
}

interface Page {
  status: number;
  location: string;
  html: string;
}

async function visit(pathname: string, cookie?: string, headers: Record<string, string> = {}): Promise<Page> {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: "manual",
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  });
  const html = await response.text();
  return { status: response.status, location: response.headers.get("location") ?? "", html };
}

/** Visible text only: scripts/styles carry RSC payloads full of the word "undefined". */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

const RAW_KEY = new RegExp(
  String.raw`\b(?:home|market|soil|recommend|crops|admin|weather|ai|doctor|prices|messages|notifications|profile|common|auth|nav|dash|map|farms|favorites|listings|simple)\.[a-z][a-zA-Z0-9_]*(\.[a-z_]+)?`,
);

const TEXT_SMELLS: Array<[string, RegExp]> = [
  ["undefined", /\bundefined\b/],
  ["NaN", /\bNaN\b/],
  ["Infinity", /\bInfinity\b/],
  ["[object Object]", /\[object Object\]/],
  ["Invalid Date", /Invalid Date/],
  ["null", />\s*null\s*</],
];

function scan(pathname: string, html: string) {
  const text = visibleText(html);
  if (html.includes("Application error") || html.includes("Unhandled Runtime Error")) {
    report("crash", pathname, "error page rendered");
  }
  if (/TypeError:|at Object\.\w+ \(/.test(text)) {
    report("stacktrace", pathname, "possible stack trace in visible text");
  }
  const key = text.match(RAW_KEY);
  if (key && /\.(title|subtitle|body|label|button|error|status|name|hint)/.test(key[0])) {
    report("i18n", pathname, `raw key in visible text: ${key[0]}`);
  }
  for (const [label, pattern] of TEXT_SMELLS) {
    const hit = text.match(pattern);
    if (hit) report("text", pathname, `visible "${label}" (${hit[0].trim().slice(0, 40)})`);
  }
  for (const match of html.matchAll(/href="([^"]*)"/g)) {
    const href = match[1];
    if (href === "" || href === "undefined" || href === "#") {
      report("link", pathname, `href="${href}"`);
    }
  }
}

async function main() {
  console.log(`X-FARM AI crawl test → ${baseUrl}\n`);
  if (!(await startServer())) {
    console.error("server did not start");
    process.exitCode = 1;
    return;
  }
  console.log("Server ready.\n");

  console.log("Fixtures");
  await fixture({ action: "reset" });
  const farmer = await fixture({ action: "account", email: "flow.farmer@example.com", role: "farmer", fullName: "Probe Farmer" });
  const buyer = await fixture({ action: "account", email: "flow.buyer@example.com", role: "buyer", fullName: "Probe Buyer" });
  const admin = await fixture({ action: "account", email: "flow.admin@example.com", role: "admin", fullName: "Probe Admin" });
  const seller = await fixture({ action: "account", email: "flow.seller@example.com", role: "seller", fullName: "Probe Seller" });
  await fixture({ action: "farm", farmName: "Probe farm" }, farmer.cookie);
  const listing = await fixture({ action: "listing", listingTitle: "Probe paddy" }, farmer.cookie);
  const listingId = typeof listing.json.id === "string" ? listing.json.id : "";
  if (listingId) {
    await fixture({ action: "favorite", listingId }, buyer.cookie);
    await fixture({ action: "conversation", listingId }, buyer.cookie);
  }
  ok(`accounts + listing (${listingId ? "with listing" : "no listing"}) ready`);

  const farmerPages = [
    "/dashboard", "/farms", "/crops", "/soil", "/assistant", "/crop-doctor", "/recommendation",
    "/weather", "/map", "/market", "/market-prices", "/listings/mine", "/listings/new",
    "/favorites", "/messages", "/notifications", "/profile",
  ];
  if (listingId) farmerPages.push(`/listings/${listingId}/edit`);
  const adminPages = ["/admin", "/admin/users", "/admin/listings", "/admin/reports", "/admin/categories"];
  const publicPages = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/market", "/weather"];

  const found = new Set<string>();
  const load = async (pathname: string, cookie: string | undefined, role: string, expect = 200) => {
    const page = await visit(pathname, cookie);
    if (page.status !== expect) {
      report("status", `${role} ${pathname}`, `expected ${expect}, got ${page.status} ${page.location}`);
    } else {
      scan(pathname, page.html);
    }
    for (const match of page.html.matchAll(/href="(\/[^"#?]*)"/g)) found.add(match[1]);
    return page;
  };

  console.log("\nCrawling as farmer");
  for (const pathname of farmerPages) await load(pathname, farmer.cookie, "farmer");
  if (listingId) await load(`/market/${listingId}`, farmer.cookie, "farmer");

  console.log("\nCrawling as buyer");
  for (const pathname of ["/dashboard", "/market", "/favorites", "/messages", "/notifications", "/profile", "/map", "/weather"]) {
    await load(pathname, buyer.cookie, "buyer");
  }

  console.log("\nCrawling as seller");
  for (const pathname of ["/dashboard", "/market", "/listings/mine", "/listings/new", "/messages"]) {
    await load(pathname, seller.cookie, "seller");
  }

  console.log("\nCrawling as admin");
  for (const pathname of adminPages) await load(pathname, admin.cookie, "admin");

  console.log("\nCrawling anonymously");
  for (const pathname of publicPages) await load(pathname, undefined, "anonymous", pathname === "/dashboard" ? 307 : 200);

  console.log(`\nFollowing ${found.size} distinct internal links`);
  const links = [...found].sort();
  for (const link of links) {
    const page = await visit(link, farmer.cookie);
    if (page.status >= 400) {
      report("deadlink", link, `status ${page.status}`);
    } else if (page.status === 200) {
      scan(link, page.html);
    }
  }
  ok(`checked ${links.length} links`);

  console.log("\nHostile query strings and edge cases");
  const probes: Array<[string, number[]]> = [
    ["/market?q=%25", [200]],
    ["/market?q=_", [200]],
    ["/market?q=%27%20or%201%3D1--", [200]],
    ["/market?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E", [200]],
    ["/market?page=9999", [200]],
    ["/market?page=-1", [200]],
    ["/market?page=abc", [200]],
    ["/market?page=0", [200]],
    ["/market-prices?crop=%3Cscript%3E", [200]],
    ["/market?kind=__proto__", [200]],
    ["/market?sort=drop%20table", [200]],
    ["/weather", [200]],
    ["/api/geocode?lat=999&lon=999", [400]],
    ["/api/geocode?lat=-91&lon=200", [400]],
    ["/api/geocode?q=%3Cscript%3E", [200]],
    ["/api/geocode?lat=NaN&lon=NaN", [400]],
    ["/api/geocode?lat=1e999&lon=1e999", [400]],
    ["/api/geocode?lat=&lon=", [400]],
  ];
  for (const [pathname, expected] of probes) {
    const page = await visit(pathname, farmer.cookie);
    const pass = expected.includes(page.status);
    if (!pass) report("probe", pathname, `expected ${expected.join("/")}, got ${page.status}`);
    else ok(`${pathname} → ${page.status}`);
    if (page.status === 200 && page.html.includes("Application error")) report("probe", pathname, "error page");
  }

  console.log("\nLocale crawl (te / hi)");
  for (const locale of ["te", "hi"] as const) {
    const page = await visit("/dashboard", `${farmer.cookie}; xfarm-locale=${locale}`);
    if (page.status !== 200) report("status", `${locale} /dashboard`, `status ${page.status}`);
    else scan(`${locale} /dashboard`, page.html);
    const te = visibleText(page.html);
    if (/\b(Home|Dashboard|Marketplace|Weather)\b/.test(te) && locale === "te") {
      report("i18n", `${locale} /dashboard`, "English headings still visible in Telugu mode");
    }
  }

  console.log(`\n${issues.length === 0 ? "no issues found" : `${issues.length} issue(s):`}`);
  for (const issue of issues) console.log(`  · ${issue}`);
  if (issues.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("crashed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => stopServer());
