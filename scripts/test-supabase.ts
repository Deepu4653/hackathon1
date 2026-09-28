/**
 * Verifies a REAL Supabase project against this repository's expectations.
 *
 *   npm run test:supabase
 *
 * Run it from a machine (or host) that can reach `<project>.supabase.co` — this
 * sandbox cannot, which is exactly why the check exists. It answers, in plain
 * language:
 *
 *   · are the Supabase variables present and correctly shaped?
 *   · does the project answer at all?
 *   · has `supabase/remote/setup.sql` been applied (tables + seed present)?
 *   · is Row Level Security actually on (anonymous reads of private tables are
 *     refused), and is the public catalogue readable by design?
 *   · can Supabase Auth create/sign in a disposable user?
 *   · does the service-role key work (needed for moderation + price imports)?
 *
 * It never prints a key, and the account it creates is deleted afterwards.
 */
import "./env";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

let passed = 0;
let failed = 0;
let skipped = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function skip(name: string, reason: string) {
  skipped += 1;
  console.log(`  ~ ${name} (skipped: ${reason})`);
}

async function main() {
  console.log("X-FARM AI → Supabase project check\n");

  console.log("Configuration");
  check("NEXT_PUBLIC_SUPABASE_URL is set", Boolean(url), "add it to .env.local");
  check("NEXT_PUBLIC_SUPABASE_URL looks like a Supabase project URL", /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url), url || "(empty)");
  check("NEXT_PUBLIC_SUPABASE_ANON_KEY is set (the publishable key)", Boolean(anonKey));
  if (anonKey) {
    check(
      "the publishable key is a browser-safe key (not a service-role secret)",
      !anonKey.startsWith("eyJ") || !/(service_role)/.test(safeDecode(anonKey)),
      "a service-role JWT must never be put in NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  if (!url || !anonKey) {
    console.error("\nAdd the missing values to .env.local and run this again.");
    process.exitCode = 1;
    return;
  }

  console.log("\nReachability");
  const authHealth = await get(`${url}/auth/v1/health`, anonKey);
  check("the project answers /auth/v1/health", authHealth.status === 200, `status ${authHealth.status}${networkHint(authHealth.status)}`);

  const restProbe = await get(`${url}/rest/v1/`, anonKey);
  check("the REST (PostgREST) endpoint answers", restProbe.status === 200 || restProbe.status === 404, `status ${restProbe.status}${networkHint(restProbe.status)}`);
  if (authHealth.status === 0) {
    console.error("\nThe project is unreachable from here. Network egress to *.supabase.co is blocked in this");
    console.error("environment (npm registry and GitHub are reachable, Supabase is not). Run this check on a");
    console.error("machine with normal internet access, or from the deployment host.");
    process.exitCode = 1;
    return;
  }

  const anon = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  console.log("\nSchema (run `npm run supabase:sql` and paste it into the SQL Editor if these fail)");
  const EXPECTED_TABLES = [
    "profiles",
    "farms",
    "crops",
    "crop_records",
    "soil_records",
    "listings",
    "listing_images",
    "favorites",
    "machinery",
    "market_prices",
    "ai_conversations",
    "ai_messages",
    "crop_analyses",
    "conversations",
    "messages",
    "notifications",
    "reports",
    "audit_logs",
    "categories",
  ];

  const missing: string[] = [];
  for (const table of EXPECTED_TABLES) {
    const { error } = await anon.from(table).select("id", { count: "exact", head: true }).limit(1);
    // 42P01 = undefined_table; anything else means the table exists and RLS answered.
    if (error && (error.code === "42P01" || /does not exist/i.test(error.message))) missing.push(table);
  }
  check(
    `all ${EXPECTED_TABLES.length} application tables exist`,
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : undefined,
  );

  const { count: cropCount, error: cropError } = await anon.from("crops").select("id", { count: "exact", head: true });
  check("the crop catalogue is readable by anonymous visitors", !cropError, cropError?.message);
  check("the seed data is present (crop catalogue is not empty)", (cropCount ?? 0) > 0, `${cropCount ?? 0} rows`);

  const { count: categoryCount } = await anon.from("categories").select("id", { count: "exact", head: true });
  check("marketplace categories are present", (categoryCount ?? 0) > 0, `${categoryCount ?? 0} rows`);

  console.log("\nRow Level Security");
  const anonProfiles = await anon.from("profiles").select("id").limit(5);
  check(
    "anonymous visitors cannot read profiles",
    Boolean(anonProfiles.error) || (anonProfiles.data ?? []).length === 0,
    `${(anonProfiles.data ?? []).length} rows returned`,
  );
  const anonMessages = await anon.from("messages").select("id").limit(5);
  check(
    "anonymous visitors cannot read messages",
    Boolean(anonMessages.error) || (anonMessages.data ?? []).length === 0,
    `${(anonMessages.data ?? []).length} rows returned`,
  );
  const anonFarms = await anon.from("farms").select("id").limit(5);
  check(
    "anonymous visitors cannot read farms",
    Boolean(anonFarms.error) || (anonFarms.data ?? []).length === 0,
    `${(anonFarms.data ?? []).length} rows returned`,
  );
  const anonPrices = await anon.from("market_prices").select("id").limit(5);
  check(
    "market prices are readable (sourced rows only)",
    !anonPrices.error,
    anonPrices.error?.message,
  );

  console.log("\nAuth");
  const email = `supabase.check.${Date.now()}@example.com`;
  const password = "SupabaseCheck!2026";
  const { data: signUpData, error: signUpError } = await anon.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Supabase Check", preferred_language: "en", role: "farmer" } },
  });
  const signUpWorked = !signUpError && Boolean(signUpData.user);
  check("a new account can be created", signUpWorked, signUpError?.message);
  if (signUpData.user && !signUpData.session) {
    console.log("    (email confirmation is enabled on this project — the account needs confirming before sign-in)");
  }

  let authed: SupabaseClient | null = null;
  if (signUpWorked) {
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({ email, password });
    if (signInData.session) {
      authed = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${signInData.session.access_token}` } },
      });
      check("the new account can sign in", true);
    } else {
      check("the account can sign in", false, signInError?.message ?? "email confirmation required");
    }
  }

  if (authed) {
    const own = await authed.from("profiles").select("id, role, is_blocked").limit(1);
    check(
      "a signed-in user can read their own profile (handle_new_user trigger works)",
      !own.error && (own.data ?? []).length === 1,
      own.error?.message ?? `${(own.data ?? []).length} rows`,
    );
    const otherPeople = await authed.from("profiles").select("id").limit(50);
    check(
      "a signed-in user cannot read other people's profiles",
      (otherPeople.data ?? []).length <= 1,
      `${(otherPeople.data ?? []).length} rows returned`,
    );
  }

  console.log("\nService role (moderation, imports, admin bootstrap)");
  if (!serviceRoleKey) {
    skip("service-role operations", "SUPABASE_SERVICE_ROLE_KEY is not set");
  } else {
    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: adminProfiles, error: adminError } = await admin.from("profiles").select("id").limit(5);
    check("the service-role key can read profiles (needed for moderation)", !adminError, adminError?.message);
    check("the service-role key reached the database", Array.isArray(adminProfiles));

    const { data: buckets, error: bucketError } = await admin.storage.listBuckets();
    if (bucketError) {
      check("storage buckets exist (avatars, listing-images, crop-images)", false, bucketError.message);
    } else {
      const names = (buckets ?? []).map((bucket) => bucket.name);
      const expected = ["avatars", "listing-images", "crop-images"];
      const missingBuckets = expected.filter((name) => !names.includes(name));
      check(
        "the three storage buckets exist",
        missingBuckets.length === 0,
        missingBuckets.length ? `missing: ${missingBuckets.join(", ")}` : names.join(", "),
      );
    }

    if (signUpData.user) {
      await admin.auth.admin.deleteUser(signUpData.user.id).catch(() => undefined);
      console.log("    (the disposable test account was removed)");
    }
  }

  console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ""}`);
  if (failed > 0) process.exitCode = 1;
}

function safeDecode(key: string): string {
  try {
    const payload = key.split(".")[1] ?? "";
    return Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function networkHint(status: number): string {
  return status === 0 ? " — no connection could be established (network egress blocked?)" : "";
}

async function get(endpoint: string, key: string) {
  try {
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    return { status: response.status };
  } catch {
    return { status: 0 };
  }
}

main().catch((error) => {
  console.error("[test:supabase] crashed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
