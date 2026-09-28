/**
 * Deletes the local database directory and rebuilds it.
 *
 * Usage:
 *   npm run db:reset            → drop + migrate
 *   npm run db:reset -- --seed  → drop + migrate + seed
 *   npm run db:reset -- --seed --all → also remove the scratch databases used
 *                                      by `npm run test:db` / `test:flow`
 *
 * This only ever touches local directories (LOCAL_DB_DIR, default
 * `.data/pglite`). It never connects to Supabase.
 */
import "./env";

import fs from "node:fs/promises";
import path from "node:path";
import { closeDatabase, getDatabase } from "../src/lib/db/local/engine";
import { serverEnv } from "../src/lib/env.server";

const SCRATCH_DIRS = [".data/test-db", ".data/flow-db"];

async function main() {
  const dir = path.resolve(process.cwd(), serverEnv.localDbDir);
  await closeDatabase();
  await fs.rm(dir, { recursive: true, force: true });
  console.log(`Removed ${path.relative(process.cwd(), dir)}`);

  if (process.argv.includes("--all")) {
    for (const scratch of SCRATCH_DIRS) {
      const full = path.resolve(process.cwd(), scratch);
      if (full === dir) continue;
      await fs.rm(full, { recursive: true, force: true });
      console.log(`Removed ${scratch}`);
    }
  }

  await getDatabase();
  console.log("Migrations re-applied.");

  if (process.argv.includes("--seed")) {
    const seedFile = path.resolve(process.cwd(), "supabase/seed.sql");
    const seedSql = await fs.readFile(seedFile, "utf8");
    const db = await getDatabase();
    await db.exec(seedSql);
    console.log("Seed applied (categories + crop catalogue; no prices).");
  }

  await closeDatabase();
}

main().catch(async (error) => {
  console.error("[db:reset] failed:", error instanceof Error ? error.message : error);
  await closeDatabase().catch(() => undefined);
  process.exitCode = 1;
});
