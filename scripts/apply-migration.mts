#!/usr/bin/env node
/* db:apply — run a migration file against the project's database.
 *
 * WHY THIS EXISTS
 * ---------------
 * Applying schema changes was the one step in this repo that always needed the
 * owner, because nothing on this machine can execute DDL:
 *
 *   · supabase-js and PostgREST cannot run DDL at all — only the 33 declared
 *     RPCs, none of which take raw SQL.
 *   · psql IS installed (/opt/homebrew/opt/libpq/bin/psql) but there is no
 *     database password stored anywhere on the machine.
 *   · the Supabase CLI is not linked and `supabase login` is interactive.
 *   · the Management API rejects the service-role key ("JWT failed
 *     verification") — it wants a Personal Access Token, which is a different
 *     credential.
 *   · driving the dashboard through the browser needs Screen Recording and
 *     Accessibility permissions that are not granted, and clicking blind on a
 *     production database console is not worth the risk.
 *
 * ONE credential closes that gap for good: a Supabase Personal Access Token.
 *
 * SETUP (once)
 * ------------
 *   1. https://supabase.com/dashboard/account/tokens → "Generate new token"
 *   2. Add it to .env.local:
 *        SUPABASE_ACCESS_TOKEN=sbp_...
 *
 * Then any migration can be applied without the owner:
 *   npm run db:apply supabase/migrations/<file>.sql
 *
 * The token is account-scoped, so treat it like the service-role key: it stays
 * in .env.local, which is git-ignored.
 *
 * SAFETY
 * ------
 * The script refuses a file containing a destructive statement unless --force
 * is passed. Additive migrations (CREATE ... IF NOT EXISTS, ADD COLUMN IF NOT
 * EXISTS) run freely; anything that can lose data has to be deliberate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv(): Record<string, string> {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/* Statements that can lose data or break a running app. Comments are stripped
   before matching so a migration that merely DESCRIBES a drop is not blocked.
 *
 * NOT listed, deliberately: `DROP POLICY|TRIGGER|INDEX|FUNCTION IF EXISTS`
 * followed by a CREATE. That is the idempotent re-declaration pattern every
 * migration in this repo uses, and a first version of this list blocked the
 * invitation migration on its own `DROP TRIGGER IF EXISTS` — a guard that
 * cries wolf on the normal case gets bypassed with --force out of habit,
 * which is worse than not having it. These drop a definition, never data.
 *
 * A DROP of a table, column, schema or database is a different thing: it can
 * destroy rows. Those stay blocked. */
const DESTRUCTIVE = [
  /\bDROP\s+(TABLE|COLUMN|SCHEMA|DATABASE|TYPE)\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+TABLE\s+\S+\s+DROP\s+(COLUMN|CONSTRAINT)\b/i,
  /\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i,
  /\bUPDATE\s+\w+\s+SET\b(?![^;]*\bWHERE\b)/i, // an unbounded UPDATE
];

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n");
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
  console.error("usage: npm run db:apply <path/to/migration.sql> [--force]");
  process.exit(1);
}

const sqlPath = path.isAbsolute(target) ? target : path.join(ROOT, target);
if (!fs.existsSync(sqlPath)) {
  console.error(`✗ not found: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const bare = stripComments(sql);

const hits = DESTRUCTIVE.filter((re) => re.test(bare));

if (hits.length > 0 && !force) {
  console.error("✗ refusing to run: this migration can destroy data.\n");
  for (const re of hits) {
    const m = re.exec(bare);
    console.error(`   ${m ? m[0].replace(/\s+/g, " ").trim() : String(re)}`);
  }
  console.error("\n   Re-run with --force if that is genuinely intended.");
  process.exit(1);
}

const env = loadEnv();
const token = process.env.SUPABASE_ACCESS_TOKEN ?? env.SUPABASE_ACCESS_TOKEN;
const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const ref = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1];

if (!ref) {
  console.error("✗ could not read the project ref from NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}

if (!token) {
  console.error("✗ SUPABASE_ACCESS_TOKEN is not set.\n");
  console.error("  This is the ONE credential that lets migrations be applied from here.");
  console.error("  Without it, DDL needs the dashboard: supabase-js cannot run DDL, psql has");
  console.error("  no stored password, the CLI is not linked, and the Management API rejects");
  console.error("  the service-role key.\n");
  console.error("  1. https://supabase.com/dashboard/account/tokens → Generate new token");
  console.error("  2. Add to .env.local:  SUPABASE_ACCESS_TOKEN=sbp_...\n");
  console.error(`  Meanwhile: paste ${path.relative(ROOT, sqlPath)} into`);
  console.error(`  https://supabase.com/dashboard/project/${ref}/sql/new`);
  process.exit(2);
}

console.log(`→ ${path.relative(ROOT, sqlPath)}  (${sql.length} bytes)`);
console.log(`→ project ${ref}`);


const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: sql }),
});

const bodyText = await res.text();
if (!res.ok) {
  console.error(`\n✗ failed (HTTP ${res.status})`);
  console.error(bodyText.slice(0, 1200));
  process.exit(1);
}

console.log("\n✓ applied");
/* Echo whatever the API returned — a migration that ends in a SELECT reports
   its own verification, and an empty array is the normal result for pure DDL. */
if (bodyText && bodyText !== "[]") console.log(bodyText.slice(0, 600));
