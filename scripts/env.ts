/**
 * Loads `.env.local` / `.env` for CLI scripts.
 *
 * The Next.js runtime reads these files itself; plain `tsx scripts/…` does not.
 * Import this FIRST in a script (before anything that reads `process.env`) so a
 * script sees exactly the same configuration as the running application.
 *
 * Existing environment variables always win, so scripts can be pointed at a
 * scratch database with `LOCAL_DB_DIR=… npm run test:db`.
 */
import fs from "node:fs";
import path from "node:path";

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals === -1) continue;
    const key = line.slice(0, equals).replace(/^export\s+/, "").trim();
    if (!key) continue;
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const root = process.cwd();

for (const file of [".env.local", ".env"]) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const values = parseEnvFile(fs.readFileSync(fullPath, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}
