/**
 * Local reference database engine.
 *
 * When Supabase credentials are not configured, X-FARM AI still runs against a
 * REAL PostgreSQL instance (@electric-sql/pglite — PostgreSQL compiled to WASM)
 * using the very same migration files that are applied to Supabase. Row Level
 * Security is enforced by switching into the `anon` / `authenticated` /
 * `service_role` roles and setting the same JWT claim GUCs PostgREST sets.
 *
 * This means every permission rule verified locally is the same rule that runs
 * in production, with no second implementation to keep in sync.
 */

import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs/promises";
import { serverEnv } from "@/lib/env.server";
import type { AuthContext } from "./auth-context";

type PGliteInstance = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  exec: (sql: string) => Promise<unknown>;
  close: () => Promise<void>;
};

const transactionDepth = new AsyncLocalStorage<number>();
/**
 * The context a `withAuthContext` call is currently running under.
 *
 * Repositories ask `getDataClient()` for a client; when a caller has already
 * opened an explicit context (CLI scripts, tests, background jobs) the client
 * must inherit it instead of trying to read a request cookie that does not
 * exist.
 */
const currentAuthContext = new AsyncLocalStorage<AuthContext>();

/**
 * The open database promise.
 *
 * It is parked on `globalThis` on purpose: in development Next.js reloads
 * changed modules, and a reload that forgot the previous instance would open a
 * SECOND PostgreSQL connection to the same data directory. PostgreSQL does not
 * allow that, and the result is an abrupt `Aborted()` from the WASM engine.
 * Reusing the instance across reloads keeps the preview stable while editing.
 */
const globalForDb = globalThis as unknown as { __xfarmLocalDatabase?: Promise<PGliteInstance> | null };

function getDatabasePromise(): Promise<PGliteInstance> | null {
  return globalForDb.__xfarmLocalDatabase ?? null;
}

function setDatabasePromise(value: Promise<PGliteInstance> | null) {
  globalForDb.__xfarmLocalDatabase = value;
}

const SQL_DIRS = ["supabase/local", "supabase/migrations"];

async function applyMigrations(db: PGliteInstance) {
  await db.exec(`
    create schema if not exists public;
    create table if not exists public.x_farm_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows } = await db.query<{ filename: string }>(
    "select filename from public.x_farm_migrations",
  );
  const applied = new Set(rows.map((row) => row.filename));
  const root = process.cwd();

  const files: Array<{ name: string; fullPath: string }> = [];
  for (const dir of SQL_DIRS) {
    const fullDir = path.join(root, dir);
    let entries: string[] = [];
    try {
      entries = await fs.readdir(fullDir);
    } catch {
      continue;
    }
    for (const entry of entries.filter((file) => file.endsWith(".sql")).sort()) {
      files.push({ name: `${dir}/${entry}`, fullPath: path.join(fullDir, entry) });
    }
  }

  for (const file of files) {
    if (applied.has(file.name)) continue;
    const sql = await fs.readFile(file.fullPath, "utf8");
    try {
      await db.exec(sql);
      await db.query("insert into public.x_farm_migrations (filename) values ($1) on conflict do nothing", [
        file.name,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Local migration failed for ${file.name}: ${message}`);
    }
  }
}

async function bootstrap(): Promise<PGliteInstance> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = path.resolve(process.cwd(), serverEnv.localDbDir);
  await fs.mkdir(dataDir, { recursive: true });

  const db = (await PGlite.create(dataDir)) as unknown as PGliteInstance;

  await db.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin noinherit bypassrls;
      end if;
    end $$;
  `);

  await applyMigrations(db);
  return db;
}

export async function getDatabase(): Promise<PGliteInstance> {
  let databasePromise = getDatabasePromise();
  if (!databasePromise) {
    databasePromise = bootstrap().catch((error) => {
      setDatabasePromise(null);
      throw error;
    });
    setDatabasePromise(databasePromise);
  }
  return databasePromise;
}

/**
 * Serialises access to the single PostgreSQL connection and runs `fn` inside a
 * transaction whose role + JWT claims make RLS behave exactly like production.
 * Re-entrant calls run inline (no deadlock).
 */
export function getCurrentAuthContext(): AuthContext | null {
  return currentAuthContext.getStore() ?? null;
}

export async function withAuthContext<T>(
  context: AuthContext,
  fn: (db: PGliteInstance) => Promise<T>,
): Promise<T> {
  const db = await getDatabase();
  if ((transactionDepth.getStore() ?? 0) > 0) {
    return fn(db);
  }
  return currentAuthContext.run(context, () => transactionDepth.run(1, async () => {
    await db.exec("begin");
    try {
      if (context.role !== "postgres") {
        await db.exec(`set local role ${context.role}`);
      }
      await db.query(
        `select
           set_config('request.jwt.claims', $1, true),
           set_config('request.jwt.claim.role', $2, true),
           set_config('request.jwt.claim.sub', $3, true),
           set_config('request.jwt.claim.email', $4, true)`,
        [
          JSON.stringify({
            sub: context.userId,
            role: context.role,
            email: context.email,
            aud: "authenticated",
          }),
          context.role,
          context.userId,
          context.email,
        ],
      );
      const result = await fn(db);
      await db.exec("commit");
      return result;
    } catch (error) {
      try {
        await db.exec("rollback");
      } catch {
        /* connection already unwound */
      }
      throw error;
    }
  }));
}

/** Closes the local database (used by CLI scripts and tests). */
export async function closeDatabase() {
  const databasePromise = getDatabasePromise();
  if (databasePromise) {
    const db = await databasePromise;
    setDatabasePromise(null);
    await db.close();
  }
}
