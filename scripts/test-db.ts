/**
 * Database + security tests against the REAL PostgreSQL engine.
 *
 * These are integration tests, not mocks: they run migrations, insert rows as
 * the `postgres` role, then re-query as `anon` / `authenticated` / `service_role`
 * exactly like PostgREST does, and assert that RLS answers correctly.
 */
import "./env";
// Runs against its own database directory: a test suite must never be able to
// corrupt the database the dev server is serving.
process.env.LOCAL_DB_DIR = process.env.LOCAL_DB_DIR || ".data/test-db";

import { closeDatabase, getDatabase, withAuthContext } from "../src/lib/db/local/engine";
import { anonContext, internalContext, serviceContext, userContext } from "../src/lib/db/local/auth-context";

type PGliteInstance = Awaited<ReturnType<typeof getDatabase>>;

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

async function expectDenied(name: string, fn: () => Promise<unknown[]>) {
  try {
    const rows = await fn();
    check(name, rows.length === 0, `expected no rows, received ${rows.length}`);
  } catch (error) {
    // A raised error is also a correct denial.
    check(name, true, error instanceof Error ? error.message : undefined);
  }
}

async function scalar(db: PGliteInstance, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await db.query<{ count: string }>(sql, params);
  return Number(rows[0]?.count ?? 0);
}

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const ADMIN = "33333333-3333-4333-8333-333333333333";

async function seedFixtures(db: PGliteInstance) {
  await db.query("delete from public.listings where seller_id in ($1,$2,$3)", [USER_A, USER_B, ADMIN]);
  await db.query("delete from public.farms where user_id in ($1,$2,$3)", [USER_A, USER_B, ADMIN]);
  await db.query("delete from public.notifications where user_id in ($1,$2,$3)", [USER_A, USER_B, ADMIN]);

  // Profiles are owned by the auth schema in production and here alike: the
  // handle_new_user() trigger mirrors every auth user into public.profiles.
  await db.query("delete from auth.users where id in ($1,$2,$3)", [USER_A, USER_B, ADMIN]);
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, 'farmer.a@example.com',
             '{"full_name":"Farmer A","preferred_language":"te","simple_mode":true}'::jsonb),
            ($2, 'trader.b@example.com',
             '{"full_name":"Trader B","preferred_language":"hi"}'::jsonb),
            ($3, 'admin@example.com', '{"full_name":"Admin"}'::jsonb)`,
    [USER_A, USER_B, ADMIN],
  );

  // Changing a role is privileged by design, so the fixtures do it as the
  // service role — exactly like an administrator action would.
  await withAuthContext(serviceContext, async (auth) => {
    await auth.query("update public.profiles set role='buyer', simple_mode=false where id=$1", [USER_B]);
    await auth.query("update public.profiles set role='admin' where id=$1", [ADMIN]);
  });

  await db.query(
    `insert into public.farms (user_id, name, village, district, is_primary)
     values ($1,'A farm','Kurnool village','Kurnool',true),
            ($2,'B farm','Guntur village','Guntur',true)`,
    [USER_A, USER_B],
  );

  await db.query(
    `insert into public.listings (seller_id, kind, title, price_per_unit, unit, status, district)
     values ($1,'produce','A paddy 25 bags',2200,'quintal','active','Kurnool'),
            ($2,'produce','B chilli lot',18000,'quintal','active','Guntur')`,
    [USER_A, USER_B],
  );
}

async function main() {
  const db = await getDatabase();

  console.log("\nMigrations");
  const migrationCount = await scalar(db, "select count(*)::text as count from public.x_farm_migrations");
  check("migration bookkeeping table populated", migrationCount > 0, `${migrationCount} files`);
  const tableCount = await scalar(
    db,
    "select count(*)::text as count from information_schema.tables where table_schema='public'",
  );
  check("public tables created", tableCount >= 20, `${tableCount} tables`);

  const rlsEnabled = await scalar(
    db,
    "select count(*)::text as count from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relrowsecurity",
  );
  check("row level security enabled on public tables", rlsEnabled >= 20, `${rlsEnabled} tables with RLS`);

  console.log("\nReference data");
  await seedFixtures(db);

  console.log("\nRLS: anonymous visitors");
  const anonListings = await withAuthContext(anonContext, async (auth) =>
    (await auth.query<{ id: string }>("select id from public.listings")).rows,
  );
  check("anon can read active listings (public marketplace)", anonListings.length >= 2, `${anonListings.length} rows`);

  await expectDenied("anon cannot read profiles", async () =>
    withAuthContext(anonContext, async (auth) => (await auth.query("select id from public.profiles")).rows),
  );

  await expectDenied("anon cannot read farms", async () =>
    withAuthContext(anonContext, async (auth) => (await auth.query("select id from public.farms")).rows),
  );

  await expectDenied("anon cannot read messages", async () =>
    withAuthContext(anonContext, async (auth) => (await auth.query("select id from public.messages")).rows),
  );

  await expectDenied("anon cannot read ai conversations", async () =>
    withAuthContext(anonContext, async (auth) => (await auth.query("select id from public.ai_conversations")).rows),
  );

  console.log("\nRLS: signed-in farmers");
  const ownFarms = await withAuthContext(userContext(USER_A, "a@example.com"), async (auth) =>
    (await auth.query<{ user_id: string }>("select user_id from public.farms")).rows,
  );
  check("farmer A sees only their own farm", ownFarms.length === 1 && ownFarms[0]?.user_id === USER_A, `${ownFarms.length} rows`);

  const otherFarmerFarms = await withAuthContext(userContext(USER_B, "b@example.com"), async (auth) =>
    (await auth.query<{ user_id: string }>("select user_id from public.farms")).rows,
  );
  check("farmer B cannot see farmer A's farm", otherFarmerFarms.every((row) => row.user_id === USER_B), JSON.stringify(otherFarmerFarms));

  const ownListings = await withAuthContext(userContext(USER_A, "a@example.com"), async (auth) =>
    (await auth.query<{ seller_id: string }>("select seller_id from public.listings")).rows,
  );
  check("marketplace listings stay visible to everyone signed in", ownListings.length >= 2, `${ownListings.length} rows`);

  const acceptedUpdate = await withAuthContext(userContext(USER_A, "a@example.com"), async (auth) => {
    await auth.query("update public.profiles set village='Ongole' where id=$1", [USER_A]);
    const { rows } = await auth.query<{ village: string }>("select village from public.profiles where id=$1", [USER_A]);
    return rows[0]?.village;
  });
  check("farmer can update their own profile", acceptedUpdate === "Ongole", String(acceptedUpdate));

  const blockedUpdate = await withAuthContext(userContext(USER_A, "a@example.com"), async (auth) => {
    await auth.query("update public.profiles set full_name='hacked' where id=$1", [USER_B]);
    const { rows } = await auth.query<{ full_name: string }>(
      "select full_name from public.profiles where id=$1 or id=$2",
      [USER_A, USER_B],
    );
    return rows.some((row) => row.full_name === "hacked");
  });
  check("farmer cannot edit another user's profile", blockedUpdate === false);

  const escalation = await withAuthContext(userContext(USER_A, "a@example.com"), async (auth) => {
    try {
      await auth.query("update public.profiles set role='admin' where id=$1", [USER_A]);
      const { rows } = await auth.query<{ role: string }>("select role from public.profiles where id=$1", [USER_A]);
      return rows[0]?.role;
    } catch {
      return "blocked";
    }
  });
  check("self-promotion to admin is blocked", escalation !== "admin", String(escalation));

  // Notifications are generated by trusted server-side code and triggers, never
  // by the browser: a signed-in user has no INSERT policy at all.
  const ownNotification = await withAuthContext(userContext(USER_A, "a@example.com"), async (auth) => {
    try {
      await auth.query("insert into public.notifications (user_id, type, title) values ($1,'system','mine')", [USER_A]);
      return "inserted";
    } catch {
      return "rejected";
    }
  });
  check("clients cannot forge notifications (server-side only)", ownNotification === "rejected", ownNotification);

  await withAuthContext(serviceContext, async (auth) => {
    await auth.query("insert into public.notifications (user_id, type, title) values ($1,'system','mine')", [USER_A]);
    await auth.query("insert into public.notifications (user_id, type, title) values ($1,'system','theirs')", [USER_B]);
  });

  const notificationsA = await withAuthContext(userContext(USER_A, "a@example.com"), async (auth) =>
    (await auth.query<{ user_id: string; title: string }>("select user_id, title from public.notifications")).rows,
  );
  check(
    "notifications are private to their owner",
    notificationsA.length === 1 && notificationsA[0]?.user_id === USER_A,
    JSON.stringify(notificationsA),
  );

  console.log("\nConstraints that prevent fabricated data");
  const priceWithoutSource = await withAuthContext(serviceContext, async (auth) => {
    try {
      await auth.query(
        "insert into public.market_prices (crop_name, market_name, price_per_quintal, unit, price_date, source) values ('Paddy','Nowhere',1,'INR/quintal','2026-01-01','')",
      );
      return "inserted";
    } catch {
      return "rejected";
    }
  });
  check("market price without a source is rejected", priceWithoutSource === "rejected", priceWithoutSource);

  const soilDatasetWithoutName = await withAuthContext(userContext(USER_A, "a@example.com"), async (auth) => {
    try {
      await auth.query(
        "insert into public.soil_records (user_id, soil_type, ph, source) values ($1,'black',7.1,'dataset')",
        [USER_A],
      );
      return "inserted";
    } catch {
      return "rejected";
    }
  });
  check("dataset-derived soil value requires a dataset name", soilDatasetWithoutName === "rejected", soilDatasetWithoutName);

  const badStatus = await withAuthContext(userContext(USER_A, "a@example.com"), async (auth) => {
    try {
      await auth.query(
        "insert into public.listings (seller_id, kind, title, status) values ($1,'produce','Bad status','nonsense')",
        [USER_A],
      );
      return "inserted";
    } catch {
      return "rejected";
    }
  });
  check("invalid listing status is rejected by a CHECK constraint", badStatus === "rejected", badStatus);

  console.log("\nService role and audit");
  await withAuthContext(serviceContext, async (auth) => {
    await auth.query("update public.profiles set is_blocked=true where id=$1", [USER_B]);
  });
  const blocked = await withAuthContext(serviceContext, async (auth) =>
    (await auth.query<{ is_blocked: boolean }>("select is_blocked from public.profiles where id=$1", [USER_B])).rows[0]?.is_blocked,
  );
  check("service role can moderate users", blocked === true);

  const auditInsert = await withAuthContext(serviceContext, async (auth) => {
    try {
      await auth.query("insert into public.audit_logs (actor_id, action, entity) values ($1,'test.run','profiles')", [ADMIN]);
      return "ok";
    } catch {
      return "rejected";
    }
  });
  check("audit log accepts service-role entries", auditInsert === "ok", auditInsert);

  const internalCount = await withAuthContext(internalContext, async (auth) =>
    scalar(auth, "select count(*)::text as count from public.profiles"),
  );
  check("internal context (local auth store) can read profiles", internalCount >= 3, `${internalCount} rows`);

  await closeDatabase();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error("[test:db] crashed:", error instanceof Error ? error.message : error);
  await closeDatabase().catch(() => undefined);
  process.exitCode = 1;
});
