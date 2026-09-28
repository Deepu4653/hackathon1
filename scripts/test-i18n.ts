/**
 * Static audit of the i18n dictionaries.
 *
 *   npm run test:i18n
 *
 * Keys written as plain strings are checked by TypeScript. Keys built with a
 * template literal (`t(`market.status.${row.status}` as never)`) are not — the
 * cast silences the compiler, so a missing entry would show up to a farmer as a
 * raw key like `market.machinery.type.tractor`. This script resolves every such
 * template against the real enum values the database and the schemas use, and
 * fails if any of them has no translation.
 */
import fs from "node:fs";
import path from "node:path";
import { en } from "../src/lib/i18n/dictionaries/en";

const known = new Set(Object.keys(en));
const root = path.join(process.cwd(), "src");

/** Templates like `market.status.${x}` → resolved against the real enum values. */
const ENUMS: Record<string, string[]> = {
  "market.status": ["draft", "active", "sold", "archived", "removed"],
  "market.reportReason": ["fake_listing", "wrong_price", "prohibited_item", "spam", "abusive", "other"],
  "market.kind": ["produce", "input", "machinery", "service"],
  "auth.role": ["farmer", "seller", "buyer", "distributor", "machine_owner", "admin"],
  "home.role": ["farmer", "seller", "buyer", "distributor", "machine_owner", "admin"],
  "doctor.confidence": ["high", "medium", "low"],
  "doctor.severity": ["high", "moderate", "low", "unknown"],
  "recommend.suitability": ["best", "good", "possible"],
  "crops.status": ["planned", "sown", "growing", "harvested", "failed"],
  "crops.water": ["low", "medium", "high"],
  "weather.alert": [
    "rain_today", "heavy_rain", "high_wind", "heat", "humidity", "spray_caution", "dry_spell",
  ],
  "notifications.type": ["weather", "marketplace", "message", "listing", "reminder", "system"],
  "soil.source": ["manual", "lab", "dataset", "estimate"],
  "market.machinery.status": ["available", "booked", "maintenance", "inactive"],
  "crops.season": ["kharif", "rabi", "zaid", "perennial", "other"],
  "soil.hint": ["low", "optimal", "high", "unknown"],
  "recommend.water": ["low", "medium", "high"],
  "soil.type": ["black", "red", "loamy", "sandy", "clay", "alluvial", "laterite"],
  "admin.reportStatus": ["open", "reviewing", "resolved", "dismissed"],
  "market.machinery.type": [
    "tractor", "harvester", "power_tiller", "sprayer", "seeder",
    "thresher", "rotavator", "trailer", "irrigation_pump", "other",
  ],
  "listing.unit": ["quintal", "kg", "tonne", "bag", "piece", "hour", "day", "acre"],
};

const files: string[] = [];
(function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
})(root);

const problems: string[] = [];
const templateRe = /[^A-Za-z0-9_$]t\(\s*`([^`]+)`/g;

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  let match: RegExpExecArray | null;
  while ((match = templateRe.exec(source))) {
    const template = match[1];
    const prefix = template.split("${")[0];
    if (!prefix) continue;
    const values = ENUMS[prefix.replace(/\.$/, "")];
    if (!values) {
      problems.push(`${path.relative(process.cwd(), file)}: no enum known for \`${template}\``);
      continue;
    }
    for (const value of values) {
      const key = `${prefix}${value}`;
      if (!known.has(key)) problems.push(`${path.relative(process.cwd(), file)}: missing key "${key}"`);
    }
  }
}

if (problems.length === 0) {
  console.log("✓ every dynamically built translation key exists in the English dictionary");
} else {
  console.log(`${problems.length} problem(s):`);
  for (const line of problems) console.log(`  ✗ ${line}`);
  process.exitCode = 1;
}
