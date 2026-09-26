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
     ..  the hiding helpers: bank balances, inventory cost, and an order's
         profit and supplier cost — each with its own flag, what is still
         owed kept; the «Bank & Profit» door; what is owed on a supplier line
     ..  supplier totals, opening lines and setup cards: hidden by the same
         two answers, receivables and payables kept
     ..  reports: treasury «Bank & Profit», supplier statement the switch,
         executive summary both, the rest open

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
  hideOpeningAmount,
  hideOrderFigures,
  hideSetupCardTotal,
  hideSupplierTotals,
  openingCategoryRefusal,
  reportRefusal,
  requireBankAndProfit,
  requireFinanceNumbers,
} from "../src/lib/experience";
import { supplierOutstanding } from "../src/lib/finance/calc";

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

  /* An order carries both kinds (/api/finance/orders): its profit needs
     «Bank & Profit», what its suppliers cost the «private records» switch.
     Each goes to 0 (null stays null) with its own flag; what is still owed —
     outstanding_payable, and outstanding_amount on each line — stays, or the
     payables would vanish with the cost. */
  const order = {
    order_no: "SO-1", selling_price: 1000, gross_profit: 300, net_profit: 250, net_profit_pct: 25,
    realized_cash_position: 120, expected_profit: null, total_supplier_cost: 700, paid_supplier_amount: 400,
    outstanding_payable: 300,
    suppliers: [{ supplier_name: "Yili", supplier_cost: 700, paid_amount: 400, outstanding_amount: 300 }],
  };
  const noProfit = hideOrderFigures(order, { profit: false, cost: true }) as typeof order & { profit_hidden?: boolean; cost_hidden?: boolean };
  ok(
    `${String(n++).padStart(2, "0")}  hideOrderFigures without «Bank & Profit» zeroes the profit (null stays null), keeps the cost, says so`,
    noProfit.gross_profit === 0 && noProfit.net_profit === 0 && noProfit.net_profit_pct === 0 && noProfit.realized_cash_position === 0
      && noProfit.expected_profit === null && noProfit.profit_hidden === true && noProfit.cost_hidden === undefined
      && noProfit.total_supplier_cost === 700 && noProfit.suppliers[0].supplier_cost === 700 && noProfit.selling_price === 1000,
    JSON.stringify(noProfit),
  );
  const noCost = hideOrderFigures(order, { profit: true, cost: false }) as typeof order & { profit_hidden?: boolean; cost_hidden?: boolean };
  ok(
    `${String(n++).padStart(2, "0")}  hideOrderFigures without the switch zeroes the supplier cost, lines included, keeps what is owed, says so`,
    noCost.total_supplier_cost === 0 && noCost.paid_supplier_amount === 0 && noCost.suppliers[0].supplier_cost === 0
      && noCost.suppliers[0].paid_amount === 0 && noCost.suppliers[0].outstanding_amount === 300 && noCost.outstanding_payable === 300
      && noCost.suppliers[0].supplier_name === "Yili" && noCost.cost_hidden === true && noCost.profit_hidden === undefined
      && noCost.net_profit === 250 && order.suppliers[0].supplier_cost === 700,
    JSON.stringify(noCost),
  );
  ok(
    `${String(n++).padStart(2, "0")}  hideOrderFigures with both rights hands the order back untouched`,
    hideOrderFigures(order, { profit: true, cost: true }) === order,
  );

  const lockedDoor = await requireBankAndProfit(ctx({ can_view_private: true }), "The financial statements");
  const lockedBody = lockedDoor ? ((await lockedDoor.json()) as { code?: string }) : null;
  ok(
    `${String(n++).padStart(2, "0")}  the «Bank & Profit» door refuses a role without the row (the switch is not enough)`,
    lockedDoor?.status === 403 && lockedBody?.code === "needs_bank_profit",
    `status=${lockedDoor?.status ?? "passed"} code=${lockedBody?.code ?? "-"}`,
  );
  const saBankDoor = await requireBankAndProfit(ctx({ is_super_admin: true }), "The financial statements");
  ok(`${String(n++).padStart(2, "0")}  the «Bank & Profit» door lets a super admin in`, saBankDoor === null, `status=${saBankDoor?.status ?? "passed"}`);

  /* What is owed on a line: the server's figure when it sent one (the cost
     and paid arrive as 0 without the switch), else cost − paid, never below 0. */
  ok(
    `${String(n++).padStart(2, "0")}  supplierOutstanding reads the server's outstanding_amount first, else cost − paid (never negative)`,
    supplierOutstanding({ supplier_cost: 0, paid_amount: 0, outstanding_amount: 300 }) === 300
      && supplierOutstanding({ supplier_cost: 700, paid_amount: 400 }) === 300
      && supplierOutstanding({ supplier_cost: 100, paid_amount: 150 }) === 0,
  );

  /* Supplier accounts: what was bought and paid is the supplier cost; what
     is still owed is a payable and stays. */
  const sup = hideSupplierTotals({ supplier_name: "Yili", total_purchases: 700, paid_amount: 400, unpaid_amount: 300, outstanding_payable: 300 });
  ok(
    `${String(n++).padStart(2, "0")}  hideSupplierTotals zeroes what was bought and paid, keeps what is owed, says so`,
    sup.total_purchases === 0 && sup.paid_amount === 0 && sup.unpaid_amount === 300 && sup.outstanding_payable === 300
      && sup.supplier_name === "Yili" && sup.cost_hidden === true,
    JSON.stringify(sup),
  );

  /* Opening balances: cash, capital, loans, other → «Bank & Profit»; the
     inventory opening → the switch; receivables, payables, fixed assets open. */
  const neither = { bankAndProfit: false, cost: false };
  const both = { bankAndProfit: true, cost: true };
  const refusals = ["cash", "owner_capital", "loan", "other", "inventory", "customer_receivable", "supplier_payable", "fixed_asset"]
    .map((cat) => `${cat}:${openingCategoryRefusal(cat, neither) ?? "open"}`).join(" ");
  ok(
    `${String(n++).padStart(2, "0")}  opening lines: cash/capital/loans/other need «Bank & Profit», inventory the switch, receivables/payables/assets stay open`,
    refusals === "cash:needs_bank_profit owner_capital:needs_bank_profit loan:needs_bank_profit other:needs_bank_profit inventory:needs_private_data customer_receivable:open supplier_payable:open fixed_asset:open"
      && ["cash", "inventory", "loan"].every((cat) => openingCategoryRefusal(cat, both) === null)
      && openingCategoryRefusal("inventory", { bankAndProfit: true, cost: false }) === "needs_private_data"
      && openingCategoryRefusal("cash", { bankAndProfit: false, cost: true }) === "needs_bank_profit",
    refusals,
  );
  const line = hideOpeningAmount({ category: "cash", label: "Petty cash", amount: 1200, currency: "CNY" });
  ok(
    `${String(n++).padStart(2, "0")}  hideOpeningAmount zeroes the amount, keeps the label, says so`,
    line.amount === 0 && line.label === "Petty cash" && line.currency === "CNY" && line.amount_hidden === true,
    JSON.stringify(line),
  );

  /* Setup cards total the same figures. */
  const cards = [
    { key: "bank_accounts", total: 900 }, { key: "cash_accounts", total: 50 }, { key: "loans", total: 300 },
    { key: "equity", total: 1000 }, { key: "opening_balances", total: 2250 }, { key: "customers_ar", total: 70 },
    { key: "suppliers_ap", total: 40 }, { key: "assets", total: 500 },
  ];
  const shown = (can: { bankAndProfit: boolean; cost: boolean }) =>
    cards.map((c) => hideSetupCardTotal(c, can)).filter((c) => !c.total_hidden).map((c) => c.key).join(",");
  ok(
    `${String(n++).padStart(2, "0")}  setup cards: bank/cash/loans/capital need «Bank & Profit», the starting position needs both`,
    shown(neither) === "customers_ar,suppliers_ap,assets"
      && shown({ bankAndProfit: true, cost: false }) === "bank_accounts,cash_accounts,loans,equity,customers_ar,suppliers_ap,assets"
      && shown(both) === cards.map((c) => c.key).join(",")
      && hideSetupCardTotal(cards[0], neither).total === 0,
    `neither=${shown(neither)} bank-only=${shown({ bankAndProfit: true, cost: false })}`,
  );

  /* Finance reports: a document is opened whole or not at all. */
  const types = ["customer_statement", "supplier_statement", "payment_report", "reconciliation_report", "treasury_report",
    "expense_report", "executive_summary", "vat_return", "ar_aging_ledger", "ap_aging_ledger"];
  const closed = (can: { bankAndProfit: boolean; cost: boolean }) => types.filter((ty) => reportRefusal(ty, can) !== null).join(",");
  ok(
    `${String(n++).padStart(2, "0")}  reports: treasury needs «Bank & Profit», supplier statement the switch, executive summary both, the rest open`,
    closed(neither) === "supplier_statement,treasury_report,executive_summary"
      && closed({ bankAndProfit: true, cost: false }) === "supplier_statement,executive_summary"
      && closed({ bankAndProfit: false, cost: true }) === "treasury_report,executive_summary"
      && closed(both) === ""
      && reportRefusal("executive_summary", neither) === "needs_bank_profit"
      && reportRefusal("executive_summary", { bankAndProfit: true, cost: false }) === "needs_private_data",
    `neither=${closed(neither)} bank-only=${closed({ bankAndProfit: true, cost: false })} switch-only=${closed({ bankAndProfit: false, cost: true })}`,
  );

  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
