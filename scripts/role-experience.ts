#!/usr/bin/env tsx

/* ===========================================================================
   Role-Based Experience validator.

   Coverage (10 assertions):
     01  inferDashboardRole — accountant department → "accountant"
     02  inferDashboardRole — sales department → "sales"
     03  inferDashboardRole — warehouse → "warehouse"
     04  inferDashboardRole — purchasing → "purchasing"
     05  inferDashboardRole — marketing → "marketing"
     06  inferDashboardRole — HR → "hr"
     07  SECURITY: a self-set preferences.dashboard_role is IGNORED
     08  Super-admin bypass on every visibility flag
     09  Cost / bank / profit visibility rules per role
     10  SECURITY: an unmatched department falls back to "staff", not "ceo"
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";
import {
  getUserExperience,
  canSeeCostData,
  canSeeBankBalances,
  canSeeProfit,
  type DashboardRole,
} from "../src/lib/experience";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) {
  console.warn("[role-experience] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = "00000000-0000-4000-a000-0000000000E1";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

/* Build a fresh account and return a synthetic ServerAuthContext
   sufficient for getUserExperience() (it only reads account_id, department,
   is_super_admin). */
async function makeAccount(opts: {
  username: string;
  department: string | null;
  isSuperAdmin?: boolean;
  preferences?: Record<string, unknown> | null;
}): Promise<{ account_id: string; department: string | null; is_super_admin: boolean }> {
  /* accounts requires either (user_type='internal' + person_id) or
     (user_type='customer' + contact_id). We create a `people` row first
     and use the internal variant. */
  await supabase.from("accounts").delete().eq("username", opts.username);

  const personIns = await supabase.from("people").insert({
    full_name: opts.username,
  }).select("id").single();
  if (personIns.error) throw new Error(`person insert: ${personIns.error.message}`);
  const personId = (personIns.data as { id: string }).id;

  const ins = await supabase.from("accounts").insert({
    tenant_id: TENANT,
    username: opts.username,
    login_email: `${opts.username}@role-test.local`,
    status: "active",
    user_type: "internal",
    person_id: personId,
    is_super_admin: !!opts.isSuperAdmin,
    preferences: opts.preferences ?? {},
  }).select("id").single();
  if (ins.error) throw new Error(`account insert: ${ins.error.message}`);
  const accountId = (ins.data as { id: string }).id;

  if (opts.department) {
    await supabase.from("koleex_employees").delete().eq("account_id", accountId);
    await supabase.from("koleex_employees").insert({
      account_id: accountId,
      tenant_id: TENANT,
      person_id: personId,
      department: opts.department,
    });
  }
  return { account_id: accountId, department: opts.department, is_super_admin: !!opts.isSuperAdmin };
}

async function ctx(scope: { account_id: string; department: string | null; is_super_admin: boolean }) {
  /* Synthesize the minimal ServerAuthContext getUserExperience needs. The
     library reads account_id (DB lookup), department, and is_super_admin —
     everything else can be filler. */
  return {
    account_id: scope.account_id,
    tenant_id: TENANT,
    role_id: null,
    department: scope.department,
    is_super_admin: scope.is_super_admin,
    can_view_private: false,
    username: "test",
    login_email: "test@test.local",
    status: "active",
    user_type: "employee",
  } as Parameters<typeof getUserExperience>[0];
}

async function cleanup() {
  /* Wipe synthetic accounts so reruns are clean. */
  const usernames = [
    "exp-accountant", "exp-sales", "exp-warehouse", "exp-purchasing",
    "exp-marketing", "exp-hr", "exp-explicit", "exp-superadmin",
    "exp-update",
  ];
  for (const u of usernames) {
    const r = await supabase.from("accounts").select("id, person_id").eq("username", u).maybeSingle();
    const row = r.data as { id: string; person_id: string | null } | null;
    if (row) {
      await supabase.from("koleex_employees").delete().eq("account_id", row.id);
      await supabase.from("accounts").delete().eq("id", row.id);
      if (row.person_id) await supabase.from("people").delete().eq("id", row.person_id);
    }
    /* People rows are also created with full_name=username; sweep any orphans. */
    await supabase.from("people").delete().eq("full_name", u);
  }
}

async function ensureTenant() {
  await supabase.from("tenants").upsert({
    id: TENANT, slug: "role-exp", name: "Role Experience Sandbox",
    is_host: false, active: true,
  }, { onConflict: "id" });
}

async function main() {
  console.log("─".repeat(72));
  console.log("  Role-Based Experience validator");
  console.log("─".repeat(72));

  await ensureTenant();
  await cleanup();

  /* 01-06 — Department-based inference. */
  const cases: Array<{ user: string; dept: string; expect: DashboardRole; n: string }> = [
    { user: "exp-accountant",  dept: "Finance & Accounting", expect: "accountant", n: "01" },
    { user: "exp-sales",       dept: "Sales Team",            expect: "sales",      n: "02" },
    { user: "exp-warehouse",   dept: "Warehouse Ops",         expect: "warehouse",  n: "03" },
    { user: "exp-purchasing",  dept: "Purchasing",            expect: "purchasing", n: "04" },
    { user: "exp-marketing",   dept: "Marketing",             expect: "marketing",  n: "05" },
    { user: "exp-hr",          dept: "Human Resources",       expect: "hr",         n: "06" },
  ];
  for (const c of cases) {
    const acc = await makeAccount({ username: c.user, department: c.dept });
    const exp = await getUserExperience(await ctx(acc));
    ok(`${c.n}  ${c.dept} → ${c.expect}`, exp.dashboard_role === c.expect, `got ${exp.dashboard_role}`);
  }

  /* 07 — SECURITY. This assertion is INVERTED from what it used to be, and the
     inversion is the point. dashboard_role gates cost / bank / profit, and it
     used to be read straight out of accounts.preferences — which the user
     wrote themselves via PATCH /api/me/preferences with no permission check at
     all. A warehouse employee could hand themselves "accountant".

     Here the stored preference asks for "accountant" (cost+bank+profit) while
     the department says warehouse (none). The department must win and the
     preference must be ignored outright. */
  const explicitAcc = await makeAccount({
    username: "exp-explicit",
    department: "Warehouse Team",
    preferences: { dashboard_role: "accountant", ui_mode: "advanced" },
  });
  const explicitExp = await getUserExperience(await ctx(explicitAcc));
  ok(
    "07  self-set preferences.dashboard_role is IGNORED (privilege escalation)",
    explicitExp.dashboard_role === "warehouse"
      && !explicitExp.can_see_cost_data
      && !explicitExp.can_see_bank_balances
      && !explicitExp.can_see_profit,
    `role=${explicitExp.dashboard_role} cost=${explicitExp.can_see_cost_data} bank=${explicitExp.can_see_bank_balances} profit=${explicitExp.can_see_profit}`,
  );

  /* 08 — Super-admin bypass on every visibility helper. */
  const sa = await makeAccount({
    username: "exp-superadmin",
    department: "Marketing",  // marketing normally hides cost/bank/profit
    isSuperAdmin: true,
  });
  const saExp = await getUserExperience(await ctx(sa));
  ok(
    "08  super-admin sees cost + bank + profit even with marketing dept",
    saExp.can_see_cost_data && saExp.can_see_bank_balances && saExp.can_see_profit,
    `cost=${saExp.can_see_cost_data} bank=${saExp.can_see_bank_balances} profit=${saExp.can_see_profit}`,
  );

  /* 09 — Visibility matrix.
       cost     : ceo / accountant / purchasing  →  yes; others  →  no
       bank     : ceo / accountant               →  yes; others  →  no
       profit   : ceo / accountant               →  yes; others  →  no */
  const matrix: Array<[DashboardRole, boolean, boolean, boolean]> = [
    ["ceo",        true,  true,  true ],
    ["accountant", true,  true,  true ],
    ["purchasing", true,  false, false],
    ["sales",      false, false, false],
    ["warehouse",  false, false, false],
    ["marketing",  false, false, false],
    ["hr",         false, false, false],
    ["staff",      false, false, false],
  ];
  let matrixOk = true;
  const detail: string[] = [];
  for (const [role, cost, bank, profit] of matrix) {
    const c = canSeeCostData(role);
    const b = canSeeBankBalances(role);
    const p = canSeeProfit(role);
    if (c !== cost || b !== bank || p !== profit) {
      matrixOk = false;
      detail.push(`${role}(c=${c}/${cost} b=${b}/${bank} p=${p}/${profit})`);
    }
  }
  ok("09  cost / bank / profit visibility matrix matches spec", matrixOk, detail.join(", "));

  /* 10 — SECURITY. The old default for an unmatched department was "ceo",
     commented "safe high-level default". It was the opposite of safe: "ceo" is
     the role that sees cost, bank balances AND profit, so every employee whose
     department string missed the keyword list was silently granted full
     financial visibility. It must fail closed. */
  const unmatched = await makeAccount({ username: "exp-unmatched", department: "Facilities" });
  const unmatchedExp = await getUserExperience(await ctx(unmatched));
  ok(
    `10  unmatched department falls back to "staff" with no visibility`,
    unmatchedExp.dashboard_role === "staff"
      && !unmatchedExp.can_see_cost_data
      && !unmatchedExp.can_see_bank_balances
      && !unmatchedExp.can_see_profit,
    `role=${unmatchedExp.dashboard_role} cost=${unmatchedExp.can_see_cost_data} bank=${unmatchedExp.can_see_bank_balances} profit=${unmatchedExp.can_see_profit}`,
  );

  await cleanup();

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
