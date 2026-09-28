/**
 * Loads `supabase/seed.sql` into the local database.
 *
 * The seed contains reference data only — categories and the crop catalogue.
 * It deliberately contains NO market prices and NO soil measurements, because
 * this platform never invents data.
 */
import "./env";

import fs from "node:fs/promises";
import path from "node:path";
import { closeDatabase, getDatabase } from "../src/lib/db/local/engine";

async function main() {
  const file = path.resolve(process.cwd(), "supabase/seed.sql");
  const sql = await fs.readFile(file, "utf8");

  const db = await getDatabase();
  await db.exec(sql);

  const tables = ["categories", "crops"] as const;
  for (const table of tables) {
    const { rows } = await db.query<{ count: string }>(`select count(*)::text as count from public.${table}`);
    console.log(`  ${table}: ${rows[0]?.count ?? "0"} row(s)`);
  }

  console.log("Seed complete (reference data only — no prices, no soil measurements).");
  await closeDatabase();
}

main().catch(async (error) => {
  console.error("[db:seed] failed:", error instanceof Error ? error.message : error);
  await closeDatabase().catch(() => undefined);
  process.exitCode = 1;
});
