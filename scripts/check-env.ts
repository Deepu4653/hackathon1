/**
 * Reports which environment variables are configured — names and status only,
 * never values. Run with `npm run env:check` (add `--strict` to exit non-zero
 * when a production deployment would be incomplete).
 */

import "./env";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GEMINI_API_KEY",
  "NEXT_PUBLIC_MAPBOX_TOKEN",
] as const;

const optional = [
  "DATA_GOV_IN_API_KEY",
  "DATA_GOV_MANDI_RESOURCE_ID",
  "SMTP_URL",
  "MAIL_FROM",
  "ADMIN_EMAILS",
  "ALLOW_DEV_RESET_LINK",
  "NEXT_PUBLIC_APP_URL",
  "DATA_BACKEND",
  "STORAGE_DRIVER",
  "LOCAL_DB_DIR",
  "LOCAL_AUTH_SECRET",
] as const;

const isSet = (name: string) => Boolean((process.env[name] ?? "").trim());
const strict = process.argv.includes("--strict");

console.log("X-FARM AI — environment check\n");

console.log("Required for a Supabase-backed deployment:");
for (const name of required) {
  console.log(`  ${isSet(name) ? "✓ set    " : "· missing"}  ${name}`);
}

console.log("\nOptional (each one unlocks a feature):");
for (const name of optional) {
  console.log(`  ${isSet(name) ? "✓ set    " : "· missing"}  ${name}`);
}

const missing = required.filter((name) => !isSet(name));
console.log("\nData backend:", process.env.DATA_BACKEND ?? (isSet("NEXT_PUBLIC_SUPABASE_URL") ? "supabase" : "local (PGlite)"));

if (missing.length > 0) {
  console.log(
    "\nWithout Supabase the app runs on the built-in local PostgreSQL (PGlite) — everything except real email\n" +
      "and cloud storage keeps working. Without GEMINI_API_KEY the AI features report that they are not configured.\n" +
      "Without NEXT_PUBLIC_MAPBOX_TOKEN the map falls back to OpenStreetMap tiles.",
  );
}

if (strict && missing.length > 0) {
  console.error(`\nStrict mode: ${missing.length} required variable(s) missing.`);
  process.exitCode = 1;
} else {
  process.exitCode = 0;
}
