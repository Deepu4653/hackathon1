/**
 * Applies every migration in `supabase/local` then `supabase/migrations` to the
 * local PostgreSQL (PGlite) runtime, exactly the files a Supabase project uses.
 * Already-applied files are skipped (tracked in `public.x_farm_migrations`).
 */
import "./env";

import { closeDatabase, getDatabase } from "../src/lib/db/local/engine";

async function main() {
  const db = await getDatabase();
  const { rows } = await db.query<{ filename: string; applied_at: string }>(
    "select filename, applied_at from public.x_farm_migrations order by filename",
  );

  console.log(`Applied ${rows.length} migration file(s):`);
  for (const row of rows) {
    console.log(`  • ${row.filename}`);
  }

  await closeDatabase();
}

main().catch(async (error) => {
  console.error("[db:migrate] failed:", error instanceof Error ? error.message : error);
  await closeDatabase().catch(() => undefined);
  process.exitCode = 1;
});
