#!/usr/bin/env tsx

/* ===========================================================================
   Finance visibility validator (validate:role-experience).

   Who sees cost data, bank balances and profit, and who approves in the
   approvals queue, comes from Roles & Permissions alone (owner's pick,
   26 Sep 2026 — src/lib/experience):
     cost           the role's «private records» switch (canViewPrivate)
     bank + profit  «Bank & Profit» under Finance
     approving      «Finance Approvals» under Finance

   This script used to create accounts in the live database to test a guess
   from the department's name — "Finance & Accounting" → accountant and so
   on. The guess is gone, and so are the writes. Every case below is decided
   before any query can run (a super admin, or an account with no role), and
   the database env is removed first, so a case that reaches for the database
   fails loudly instead of quietly reading production.

     01  super admin → cost, bank, profit and approving
     02  the «private records» switch alone → cost data only
     03  no switch and no role → nothing (fail closed)
     04+ SECURITY: a department that used to grant (Executive Office → ceo,
         Finance Department → accountant, Procurement Department →
         purchasing, Key Account Management → accountant, Project Management
         → ceo) grants nothing
     ..  SECURITY: role-mode view-as — the context's is_super_admin (forced
         off) decides, not the super admin's own account row
     ..  the finance-numbers door: a customer login is refused first, even
         with the switch; an internal account with no role is refused; a
         super admin passes
     ..  getUserExperience reports the same answers as the helpers

   The per-role answer for a real role (a koleex_permissions row) is
   requireModuleAccess's, covered where that helper is; the static guard that
   no input but these is read is validate:finance-perf §G.
   ========================================================================== */

delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

import type { ServerAuthContext } from "../src/lib/server/auth";
import {
  canApproveFinance,
  canSeeBankAndProfit,
  canSeeCostData,
  getUserExperience,
  hideBankBalances,
  hideInventoryCost,
  requireFinanceNumbers,
} from "../src/lib/experience";

let passes = 0;
let failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

function ctx(over: Partial<ServerAuthContext> = {}): ServerAuthContext {
  return {
    account_id: "00000000-0000-4000-a000-00000000e001",
    tenant_id: "00000000-0000-4000-a000-0000000000E1",
    role_id: null,
    department: null,
    is_super_admin: false,
    can_view_private: false,
    username: "probe",
    login_email: "probe@role-test.local",
    status: "active",
    user_type: "internal",
    viewing_as: false,
    real_account_id: null,
    view_as_kind: null,
    view_as_role_id: null,
    ...over,
  };
}

type Answers = { cost: boolean; bank: boolean; approve: boolean };
async function answers(auth: ServerAuthContext): Promise<Answers> {
  return {
    cost: canSeeCostData(auth),
    bank: await canSeeBankAndProfit(auth),
    approve: await canApproveFinance(auth),
  };
}
const show = (a: Answers) => `cost=${a.cost} bank+profit=${a.bank} approve=${a.approve}`;
const none = (a: Answers) => !a.cost && !a.bank && !a.approve;

async function main() {
  console.log("─".repeat(72));
  console.log("  Finance visibility validator (Roles & Permissions only)");
  console.log("─".repeat(72));

  const sa = await answers(ctx({ is_super_admin: true }));
  ok("01  super admin → cost, bank, profit and approving", sa.cost && sa.bank && sa.approve, show(sa));

  const cvp = await answers(ctx({ can_view_private: true }));
  ok("02  the «private records» switch alone → cost data only", cvp.cost && !cvp.bank && !cvp.approve, show(cvp));

  const bare = await answers(ctx());
  ok("03  no switch and no role → nothing (fail closed)", none(bare), show(bare));

  /* SECURITY. Each of these departments used to hand out financial visibility
     through a keyword regex; the first three are real names in
     koleex_departments today. The department is not an input any more. */
  const grantedBefore: Array<[string, string]> = [
    ["Executive Office", "ceo"],
    ["Finance Department", "accountant"],
    ["Procurement Department", "purchasing"],
    ["Key Account Management", "accountant"],
    ["Project Management", "ceo"],
  ];
  let n = 4;
  for (const [department, was] of grantedBefore) {
    const a = await answers(ctx({ department }));
    ok(`${String(n++).padStart(2, "0")}  department "${department}" (was → ${was}) grants nothing`, none(a), show(a));
  }

  /* SECURITY. Role-mode view-as keeps the super admin's own account_id and
     forces is_super_admin off in the context. The old resolver re-read
     accounts.is_super_admin for that account_id and previewed every role with
     super-admin visibility. The context decides. */
  const preview = await answers(ctx({ viewing_as: true, view_as_kind: "role", real_account_id: "00000000-0000-4000-a000-00000000e001" }));
  ok(`${String(n++).padStart(2, "0")}  role-mode view-as shows the role's answer, not the super admin's`, none(preview), show(preview));

  const customer = await requireFinanceNumbers(ctx({ user_type: "customer", can_view_private: true }));
  ok(`${String(n++).padStart(2, "0")}  the finance-numbers door refuses a customer login, even with the switch`, customer?.status === 403, `status=${customer?.status ?? "passed"}`);
  const noRole = await requireFinanceNumbers(ctx());
  ok(`${String(n++).padStart(2, "0")}  the finance-numbers door refuses an internal account with no role`, noRole?.status === 403, `status=${noRole?.status ?? "passed"}`);
  const saDoor = await requireFinanceNumbers(ctx({ is_super_admin: true }));
  ok(`${String(n++).padStart(2, "0")}  the finance-numbers door lets a super admin in`, saDoor === null, `status=${saDoor?.status ?? "passed"}`);

  const expSa = await getUserExperience(ctx({ is_super_admin: true }));
  const expCvp = await getUserExperience(ctx({ can_view_private: true }));
  ok(
    `${String(n++).padStart(2, "0")}  getUserExperience reports the helpers' answers`,
    expSa.can_see_cost_data && expSa.can_see_bank_balances && expSa.can_see_profit && expSa.can_approve && expSa.is_super_admin
      && expCvp.can_see_cost_data && !expCvp.can_see_bank_balances && !expCvp.can_see_profit && !expCvp.can_approve && !expCvp.is_super_admin,
    `sa=${JSON.stringify(expSa)} switch=${JSON.stringify(expCvp)}`,
  );

  /* The hiding helpers the bank-account and valuation routes use: every
     balance / cost field to 0 (a missing figure stays null), the rest of the
     row untouched, and a flag the screens turn into «•••». An account with no
     ledger entries reports minus its balance as the difference — that goes
     too. */
  const bank = hideBankBalances({ bank_name: "HSBC", current_balance: 5000, available_balance: 4000, ledger_difference: -5000, unreconciled_count: 3 });
  ok(
    `${String(n++).padStart(2, "0")}  hideBankBalances zeroes every balance, keeps the rest, says so`,
    bank.current_balance === 0 && bank.available_balance === 0 && bank.ledger_difference === 0
      && bank.bank_name === "HSBC" && bank.unreconciled_count === 3 && bank.balances_hidden === true,
    JSON.stringify(bank),
  );
  const cost = hideInventoryCost({ qty_on_hand: 7, average_cost: 12.5, inventory_value: 87.5, last_in_cost: null, unit_cost: 3 });
  ok(
    `${String(n++).padStart(2, "0")}  hideInventoryCost zeroes every cost (null stays null), keeps the quantity, says so`,
    cost.average_cost === 0 && cost.inventory_value === 0 && cost.unit_cost === 0 && cost.last_in_cost === null
      && cost.qty_on_hand === 7 && cost.cost_hidden === true,
    JSON.stringify(cost),
  );

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
