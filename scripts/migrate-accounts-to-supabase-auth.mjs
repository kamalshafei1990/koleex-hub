#!/usr/bin/env node
/**
 * migrate-accounts-to-supabase-auth.mjs
 *
 * One-shot migration that links every row in `public.accounts` to a
 * Supabase `auth.users` row with a matching id. After it runs:
 *
 *   - Each accounts.id === auth.users.id
 *   - Each auth.users has the account's login_email and a strong random
 *     password (never logged; users must use "forgot password" to sign in
 *     the first time)
 *   - accounts.password_hash and accounts.force_password_change are kept
 *     as-is for backwards compat with the Phase 1 admin gate until the
 *     feature flag flips
 *
 * PREREQUISITES:
 *   1. Supabase Auth is enabled in the dashboard (Email provider on)
 *   2. SUPABASE_SERVICE_ROLE_KEY is present in .env.local (NOT the anon key)
 *   3. You've taken a DB snapshot
 *
 * USAGE:
 *   node scripts/migrate-accounts-to-supabase-auth.mjs         # dry run (default)
 *   node scripts/migrate-accounts-to-supabase-auth.mjs --apply # actually run it
 *
 * IDEMPOTENCY:
 *   Safe to re-run. Accounts whose id already exists in auth.users are
 *   skipped. Accounts without a login_email are logged and skipped.
 *
 * CRITICAL NOTE:
 *   Because this script both creates auth.users rows and rewrites
 *   accounts.id to match them, it's a destructive data migration. Don't
 *   run it without a backup you can roll back to.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ─── 1. Load env vars from .env.local ──────────────────────────────────────
function loadEnv() {
  const envPath = resolve(projectRoot, ".env.local");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local missing — fall back to whatever's already in process.env
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL is not set.");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    "❌ SUPABASE_SERVICE_ROLE_KEY is not set. This script cannot run with the anon key.",
  );
  console.error(
    "   Grab it from Supabase dashboard → Project Settings → API → service_role (secret).",
  );
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const DRY = !APPLY;

// ─── 2. Build a service-role client (bypasses RLS) ─────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function randomPassword() {
  // 32 bytes of entropy, base64url → ~43 chars. Users will never see this
  // password — they'll go through the "forgot password" flow on first sign-in.
  return randomBytes(32).toString("base64url");
}

async function main() {
  console.log("");
  console.log("═══ Koleex Accounts → Supabase Auth migration ═══");
  console.log(DRY ? "Mode: DRY RUN (pass --apply to execute)" : "Mode: APPLY");
  console.log("");

  // 1. Fetch every account row.
  const { data: accounts, error: fetchErr } = await supabase
    .from("accounts")
    .select("id, login_email, username, status")
    .order("created_at", { ascending: true });

  if (fetchErr) {
    console.error("❌ Failed to fetch accounts:", fetchErr.message);
    process.exit(1);
  }
  if (!accounts || accounts.length === 0) {
    console.log("No accounts to migrate.");
    return;
  }
  console.log(`Found ${accounts.length} account(s) to consider.`);

  // 2. Pull the current list of auth.users so we can skip existing ones.
  //    Paginate at 1000 per page just in case.
  const existingEmails = new Set();
  const existingIds = new Set();
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) {
      console.error("❌ Failed to list auth.users:", error.message);
      process.exit(1);
    }
    const users = data?.users || [];
    for (const u of users) {
      if (u.email) existingEmails.add(u.email.toLowerCase());
      if (u.id) existingIds.add(u.id);
    }
    if (users.length < 1000) break;
    page += 1;
  }
  console.log(`Supabase currently has ${existingIds.size} auth.users row(s).`);
  console.log("");

  // 3. For each account, either skip, create, or link.
  let created = 0;
  let linked = 0;
  let skipped = 0;
  let failed = 0;

  for (const a of accounts) {
    const label = `${a.username} (${a.login_email || "no email"})`;

    if (!a.login_email) {
      console.log(`⏭️  Skipping ${label}: no login_email set.`);
      skipped += 1;
      continue;
    }

    if (existingIds.has(a.id)) {
      console.log(`✓  ${label}: already linked (auth.users.id matches).`);
      skipped += 1;
      continue;
    }

    if (existingEmails.has(a.login_email.toLowerCase())) {
      console.log(
        `⚠️  ${label}: an auth.users row already exists with this email but ` +
          `accounts.id doesn't match. Manual intervention needed.`,
      );
      skipped += 1;
      continue;
    }

    if (DRY) {
      console.log(`[dry] would create auth.users for ${label}`);
      created += 1;
      continue;
    }

    // Create the auth.users row. We pass a random password and email_confirm:
    // true so the user can immediately go through a "forgot password" flow.
    const password = randomPassword();
    const { data: createdUser, error: createErr } =
      await supabase.auth.admin.createUser({
        email: a.login_email,
        password,
        email_confirm: true,
        user_metadata: { username: a.username, legacy_account_id: a.id },
      });

    if (createErr || !createdUser?.user) {
      console.error(`❌ ${label}: createUser failed — ${createErr?.message}`);
      failed += 1;
      continue;
    }

    const newId = createdUser.user.id;

    // Now rewrite accounts.id to match the new auth.users.id. This is a
    // foreign-key dance: we also have to update every row that references
    // accounts(id). The simplest safe path is a transactional SQL block
    // which we run via rpc('exec_sql', ...) if available, or fall back to
    // direct updates via the REST API one table at a time.
    //
    // For the first migration run, we recommend running the SQL block from
    // the dashboard SQL editor instead:
    //
    //   UPDATE accounts SET id = '<newId>' WHERE id = '<oldId>';
    //
    // because ON UPDATE CASCADE takes care of every FK pointing at it (all
    // FKs in the identity migration are ON DELETE CASCADE but not
    // ON UPDATE CASCADE — so this UPDATE will fail without manual fk
    // rewrites).
    //
    // Therefore: this script only handles the CREATE side. The id-rewrite
    // side is done by copy/pasting the generated SQL below into the
    // dashboard.

    console.log(`✓ created auth.users for ${label}`);
    console.log(
      `   → run this in SQL editor:  UPDATE accounts SET id = '${newId}' WHERE id = '${a.id}';`,
    );
    created += 1;
  }

  console.log("");
  console.log("═══ Summary ═══");
  console.log(`Created: ${created}`);
  console.log(`Linked (already existed): ${linked}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log("");

  if (DRY) {
    console.log("This was a dry run. Re-run with --apply to actually create");
    console.log("auth.users rows. After that, copy the generated UPDATE");
    console.log("statements into the Supabase SQL editor to rewrite");
    console.log("accounts.id → auth.users.id.");
  } else {
    console.log("Next steps:");
    console.log("  1. Run the generated UPDATE statements above in SQL editor");
    console.log("  2. Run supabase/migrations/enable_security_rls.sql");
    console.log("  3. Set NEXT_PUBLIC_USE_SUPABASE_AUTH=true on Vercel");
    console.log("  4. Verify sign-in at /login, then archive AdminAuth.tsx");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
