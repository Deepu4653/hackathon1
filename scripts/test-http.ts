/**
 * HTTP smoke tests against a RUNNING server.
 *
 *   npm run dev            # in one terminal
 *   npm run test:http      # in another
 *
 * Override the target with TEST_BASE_URL (default http://127.0.0.1:3000).
 * Every assertion is about real behaviour: status codes, JSON shape, redirects.
 * The suite never creates accounts or writes fake data — write-path testing is
 * covered by `npm run test:db`, which exercises the same policies directly.
 */

import "./env";
const baseUrl = (process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

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

async function get(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", ...init });
}

async function main() {
  console.log(`X-FARM AI HTTP smoke test → ${baseUrl}\n`);

  let reachable = true;
  try {
    const health = await get("/api/health");
    const payload = (await health.json()) as {
      ok?: boolean;
      backend?: string;
      database?: string;
      integrations?: Record<string, boolean>;
      missing?: string[];
    };
    check("GET /api/health responds", health.status === 200 || health.status === 503, `status ${health.status}`);
    check("health reports a data backend", typeof payload.backend === "string", JSON.stringify(payload.backend));
    check("health reports database status", typeof payload.database === "string", String(payload.database));
    check("health lists integration flags", Boolean(payload.integrations), JSON.stringify(payload.integrations));
    check("health never leaks secrets", !JSON.stringify(payload).match(/sk-|service_role|eyJ/), "no token-shaped strings");
  } catch (error) {
    reachable = false;
    console.error(`  ✗ server not reachable at ${baseUrl} — start it with \`npm run dev\` (${String(error)})`);
  }

  if (!reachable) {
    console.error("\nThe server must be running for the HTTP checks. Aborting.");
    process.exitCode = 1;
    return;
  }

  const pages: Array<[string, number[]]> = [
    ["/", [200]],
    ["/login", [200]],
    ["/signup", [200]],
    ["/forgot-password", [200]],
    ["/reset-password", [200]],
    ["/market", [200]],
    ["/weather", [200]],
  ];

  console.log("\nPublic pages");
  for (const [path, expected] of pages) {
    const response = await get(path);
    const html = await response.text();
    check(`GET ${path} → ${expected.join("/")}`, expected.includes(response.status), `status ${response.status}`);
    check(`GET ${path} renders the app shell`, html.includes("X-FARM"), "brand text missing from HTML");
  }

  console.log("\nProtected routes redirect to sign-in");
  for (const path of [
    "/dashboard",
    "/assistant",
    "/crop-doctor",
    "/messages",
    "/profile",
    "/admin",
    "/listings/new",
    "/map",
    "/market-prices",
  ]) {
    const response = await get(path);
    const location = response.headers.get("location") ?? "";
    check(
      `GET ${path} is protected`,
      (response.status === 307 || response.status === 302 || response.status === 303) && location.includes("/login"),
      `status ${response.status} location ${location}`,
    );
  }

  console.log("\nAPI surface");
  const geocode = await get("/api/geocode?q=Kurnool");
  const geocodePayload = (await geocode.json()) as { ok?: boolean; places?: unknown[]; error?: string };
  check("GET /api/geocode answers", geocode.status === 200 || geocode.status === 503, `status ${geocode.status}`);
  check(
    "geocode returns places or a clear reason",
    Boolean(geocodePayload.places) || Boolean(geocodePayload.error) || geocodePayload.ok === false,
    JSON.stringify(geocodePayload).slice(0, 120),
  );

  const shortQuery = await get("/api/geocode?q=a");
  check("geocode rejects queries that are too short", shortQuery.status === 400, `status ${shortQuery.status}`);

  const anonymousPreferences = await get("/api/preferences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ simple_mode: true }),
  });
  check("POST /api/preferences requires a session", anonymousPreferences.status === 401, `status ${anonymousPreferences.status}`);

  const logout = await get("/api/auth/logout", { method: "POST" });
  check("POST /api/auth/logout redirects", [302, 303].includes(logout.status), `status ${logout.status}`);

  const protectedStoragePath = await get("/api/storage/crop-images/../../etc/passwd");
  check(
    "storage route refuses traversal / private objects for anonymous users",
    [400, 403, 404].includes(protectedStoragePath.status),
    `status ${protectedStoragePath.status}`,
  );

  console.log("\nSecurity headers");
  const home = await get("/");
  check("no X-Powered-By header", !home.headers.get("x-powered-by"));
  check("X-Content-Type-Options is nosniff", home.headers.get("x-content-type-options") === "nosniff");
  check("X-Frame-Options is set", Boolean(home.headers.get("x-frame-options")));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("[test:http] crashed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
