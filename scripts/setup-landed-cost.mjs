/**
 * setup-landed-cost.mjs
 *
 * Checks whether the `landed_cost_simulations` table exists in Supabase.
 * If not, prints the SQL the user should run in the Supabase SQL Editor.
 *
 * Usage:
 *   node scripts/setup-landed-cost.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// 1. Load env vars from .env.local
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = resolve(projectRoot, ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = process.env[key] ?? value;
    }
  } catch {
    // .env.local may not exist; rely on existing env vars
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Create Supabase client and check table
// ---------------------------------------------------------------------------
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking if landed_cost_simulations table exists...\n");

  const { data, error } = await supabase
    .from("landed_cost_simulations")
    .select("id")
    .limit(1);

  if (!error) {
    console.log("Table exists! Rows returned:", data.length);
    console.log("You are good to go.");
    return;
  }

  // Supabase returns code "42P01" for "relation does not exist"
  // or the message may contain a hint about the table not existing.
  if (
    error.code === "42P01" ||
    error.message?.includes("does not exist") ||
    error.message?.includes("relation")
  ) {
    console.log("Table does NOT exist yet.\n");
  } else {
    // Could be a permissions error or RLS issue – still print guidance.
    console.log(`Got an error when querying the table: ${error.message}\n`);
    console.log(`(Error code: ${error.code})\n`);
  }

  // Read the migration SQL and print it for the user
  const sqlPath = resolve(
    projectRoot,
    "supabase/migrations/create_landed_cost_simulations.sql"
  );
  let sql;
  try {
    sql = readFileSync(sqlPath, "utf-8");
  } catch {
    console.error("Could not read migration file at:", sqlPath);
    process.exit(1);
  }

  console.log("=".repeat(70));
  console.log("Please run the following SQL in the Supabase SQL Editor:");
  console.log("  https://supabase.com/dashboard → your project → SQL Editor");
  console.log("=".repeat(70));
  console.log();
  console.log(sql);
  console.log();
  console.log("=".repeat(70));
  console.log("After running the SQL, re-run this script to verify:");
  console.log("  node scripts/setup-landed-cost.mjs");
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
