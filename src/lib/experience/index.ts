import "server-only";

/* ===========================================================================
   Experience layer — who sees cost data, bank balances and profit, and who
   approves in the finance approvals queue.

   ROLES & PERMISSIONS DECIDE, AND NOTHING ELSE DOES (owner's pick, 26 Sep
   2026). These answers used to come from `dashboard_role`, a label guessed
   from koleex_employees.department by keyword regexes tried in order:
   "Executive Office" → ceo (everything, and an approver); "Key Account
   Management" → accountant (`\baccount` ran before the sales rule);
   "Administration & Office" → marketing (`\bad`); "Project Management" → ceo
   (`manag`). A text field HR fills in decided financial visibility, and the
   Roles page said nothing about it. Before that the label was read from
   accounts.preferences, which the user could write themselves (closed
   13 Aug 2026). Neither the department nor the preference is an input now.

     cost data      the role's «private records» switch — canViewPrivate(auth),
                    the same switch that shows a product's cost price, salaries
                    and customer credit, so "may see cost" has one answer
                    across the Hub. Inventory cost and value, bills and
                    journals in the approvals queue, the purchases / expenses /
                    inventory reports, the executive inventory figures.
     bank + profit  «Bank & Profit» under Finance in Roles & Permissions
                    (View): bank balances, the cash position, gross and net
                    profit, margins.
     approving      «Finance Approvals» under Finance (View): approve or
                    reject in the approvals queue, and find its items in the
                    CEO office's «waiting for your decision». Moving an item
                    still needs the queue's own door (internal, Finance ·
                    create — src/lib/approvals/gate.ts).

   Both rows are capabilities (src/lib/permission-modules.ts): closed until an
   admin grants one to a role or an account, super admins always. They are
   read through requireModuleAccess, so an account override grants or hides
   them the way it does a module, and view-as previews the ROLE's answer.

   is_super_admin comes from the session context alone. getUserExperience used
   to select accounts.is_super_admin again for auth.account_id — in role-mode
   view-as that is the super admin's own row, so every role's preview came out
   with super-admin visibility. The context already carries the flag, and
   forces it off in role-mode.

   Guarded by validate:finance-perf §G.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireModuleAccess, type ServerAuthContext } from "@/lib/server/auth";
import { canViewPrivate } from "@/lib/server/sensitive-columns";
import { BANK_PROFIT_MODULE, FINANCE_APPROVALS_MODULE } from "@/lib/permission-modules";

/** Cost prices, inventory value, COGS — the role's «private records» switch.
 *  Free: the session context already carries it. */
export function canSeeCostData(auth: ServerAuthContext): boolean {
  return canViewPrivate(auth);
}

/** Bank balances, the cash position, profit and margins — «Bank & Profit». */
export async function canSeeBankAndProfit(auth: ServerAuthContext): Promise<boolean> {
  return auth.is_super_admin || (await requireModuleAccess(auth, BANK_PROFIT_MODULE)) === null;
}

/** Approve or reject in the finance approvals queue — «Finance Approvals». */
export async function canApproveFinance(auth: ServerAuthContext): Promise<boolean> {
  return auth.is_super_admin || (await requireModuleAccess(auth, FINANCE_APPROVALS_MODULE)) === null;
}

/** The door to company-wide finance numbers outside the Finance app's own
 *  screens (the executive snapshot, the operational reports): internal
 *  accounts with the Finance module. A customer login shares the accounts
 *  table, so it is refused first whatever a grant says — the approvals
 *  door's rule. */
export async function requireFinanceNumbers(auth: ServerAuthContext): Promise<NextResponse | null> {
  if (auth.user_type !== "internal") {
    return NextResponse.json(
      { error: "Finance numbers are available to internal Koleex accounts only." },
      { status: 403 },
    );
  }
  return requireModuleAccess(auth, "Finance");
}

/* ── Bank balances on the wire ────────────────────────────────────────────
   For a caller without «Bank & Profit» the balances go out as 0 — numbers
   stay numbers, so no screen's arithmetic breaks — and the row carries
   `balances_hidden: true`. The flag travels WITH the row (into a warm cache,
   into an edit form), so a screen shows «•••» instead of a zero that reads
   as an empty account. ledger_difference goes too: an account with no ledger
   entries reports minus its balance there. Whether the books agree with the
   statement is `ledger_gap`, computed before this runs.

   Can't read → can't write: an edit form sends the whole row back, zeros
   included, so every writer drops BANK_BALANCE_INPUTS for such a caller
   instead of writing a balance they were never shown. */
export const BANK_BALANCE_FIELDS = [
  "opening_balance", "current_balance", "available_balance", "pending_balance", "restricted_balance",
  "ledger_balance", "ledger_base", "ledger_difference",
] as const;
export const BANK_BALANCE_INPUTS = ["opening_balance", "available_balance", "pending_balance", "restricted_balance"] as const;

export function hideBankBalances<T extends object>(row: T): T & { balances_hidden: true } {
  const out = { ...row } as Record<string, unknown>;
  for (const f of BANK_BALANCE_FIELDS) if (f in out) out[f] = 0;
  out.balances_hidden = true;
  return out as T & { balances_hidden: true };
}

/* ── Inventory cost on the wire ───────────────────────────────────────────
   The same move for cost data (the role's «private records» switch): every
   cost field a valuation row can carry goes out as 0 — or stays null where
   "no figure" was the answer — and the row says `cost_hidden: true`, so the
   screen shows «•••». Quantities are not cost and stay. */
export const INVENTORY_COST_FIELDS = [
  "cost_price", "average_cost", "avg_cost", "weighted_avg_cost", "last_in_cost",
  "inventory_value", "total_value", "unit_cost", "total_cost",
] as const;

export function hideInventoryCost<T extends object>(row: T): T & { cost_hidden: true } {
  const out = { ...row } as Record<string, unknown>;
  for (const f of INVENTORY_COST_FIELDS) if (f in out) out[f] = out[f] == null ? null : 0;
  out.cost_hidden = true;
  return out as T & { cost_hidden: true };
}

/** What an item or variant writer takes as a cost. Without the switch it is
 *  dropped from an edit (the form sends back the 0 it was shown) and a
 *  non-zero one is refused on a create — can't read → can't write. */
export const INVENTORY_COST_INPUTS = ["cost_price"] as const;

/* ── Supplier accounts (/api/finance/suppliers) ───────────────────────────
   What was bought from a supplier and what was paid on it are the supplier
   cost the orders hide (the switch): 0 with cost_hidden. What is still owed
   (unpaid_amount, outstanding_payable) is a payable and stays. */
export const SUPPLIER_TOTAL_COST_FIELDS = ["total_purchases", "paid_amount"] as const;

export function hideSupplierTotals<T extends object>(row: T): T & { cost_hidden: true } {
  const out = { ...row } as Record<string, unknown>;
  for (const f of SUPPLIER_TOTAL_COST_FIELDS) if (f in out) out[f] = out[f] == null ? null : 0;
  out.cost_hidden = true;
  return out as T & { cost_hidden: true };
}

/* ── Opening balances (/api/finance/setup/opening-balances) ───────────────
   A line is hidden where the screen that shows the same figure later is:
   cash, and the balance-sheet-only lines — owner capital, loans, other —
   are the statements' («Bank & Profit»); the inventory opening is a cost
   (the switch). What customers owe and what is owed to suppliers stay, as
   in the aging; fixed assets stay, as in the asset register. A hidden line
   is neither added nor removed by such a caller: removing one voids its
   journal, a change to figures they cannot see. */
export const OPENING_BANK_PROFIT_CATEGORIES = ["cash", "owner_capital", "loan", "other"] as const;
export const OPENING_COST_CATEGORIES = ["inventory"] as const;

/** The refusal code for an opening category this caller may not see or
 *  write, or null when they may. */
export function openingCategoryRefusal(
  category: string,
  can: { bankAndProfit: boolean; cost: boolean },
): "needs_bank_profit" | "needs_private_data" | null {
  if (!can.bankAndProfit && (OPENING_BANK_PROFIT_CATEGORIES as readonly string[]).includes(category)) return "needs_bank_profit";
  if (!can.cost && (OPENING_COST_CATEGORIES as readonly string[]).includes(category)) return "needs_private_data";
  return null;
}

export function hideOpeningAmount<T extends object>(row: T): T & { amount_hidden: true } {
  const out = { ...row } as Record<string, unknown>;
  if ("amount" in out) out.amount = out.amount == null ? null : 0;
  out.amount_hidden = true;
  return out as T & { amount_hidden: true };
}

/* ── Finance reports & exports (src/lib/reports/build.ts) ─────────────────
   A report is a document, so it is opened whole or not at all: the treasury
   report is bank balances («Bank & Profit»); the supplier statement is what
   was bought (the switch); the executive summary carries profit, cash AND
   the supplier cost, so it needs both. The rest — customer statements,
   payments, reconciliation (movements, not balances), expenses, the VAT
   return and the two agings — are what the Finance screens already show. */
export const REPORTS_NEED_BANK_PROFIT = ["treasury_report", "executive_summary"] as const;
export const REPORTS_NEED_COST = ["supplier_statement", "executive_summary"] as const;

/** The refusal code for a report this caller may not open, or null. */
export function reportRefusal(
  type: string,
  can: { bankAndProfit: boolean; cost: boolean },
): "needs_bank_profit" | "needs_private_data" | null {
  if (!can.bankAndProfit && (REPORTS_NEED_BANK_PROFIT as readonly string[]).includes(type)) return "needs_bank_profit";
  if (!can.cost && (REPORTS_NEED_COST as readonly string[]).includes(type)) return "needs_private_data";
  return null;
}

/* The Finance setup cards (/api/finance/setup/status) total the same
   figures: bank, cash, loans and capital are «Bank & Profit»; the starting
   position adds up every opening line, inventory included, so it needs
   both. The rest — customers, suppliers, assets — stay. */
export const SETUP_BANK_PROFIT_CARDS = ["bank_accounts", "cash_accounts", "loans", "equity"] as const;

export function hideSetupCardTotal<T extends { key: string; total: number }>(
  card: T,
  can: { bankAndProfit: boolean; cost: boolean },
): T & { total_hidden?: true } {
  const hidden = card.key === "opening_balances"
    ? !(can.bankAndProfit && can.cost)
    : !can.bankAndProfit && (SETUP_BANK_PROFIT_CARDS as readonly string[]).includes(card.key);
  return hidden ? { ...card, total: 0, total_hidden: true as const } : card;
}

/* ── Sales orders (/api/finance/orders) ───────────────────────────────────
   An order carries both kinds: its profit («Bank & Profit») and what its
   suppliers cost (the private-records switch). Each goes out as 0 with its
   own flag. What is still owed to a supplier is a payable, not a cost price
   — it stays (outstanding_payable, and outstanding_amount on each supplier
   line), so payables and supplier dues keep adding up. */
export const ORDER_PROFIT_FIELDS = ["gross_profit", "net_profit", "net_profit_pct", "realized_cash_position", "expected_profit"] as const;
export const ORDER_COST_FIELDS = ["total_supplier_cost", "paid_supplier_amount"] as const;
export const ORDER_SUPPLIER_COST_FIELDS = ["supplier_cost", "paid_amount"] as const;

export function hideOrderFigures<T extends object>(order: T, can: { profit: boolean; cost: boolean }): T {
  if (can.profit && can.cost) return order;
  const out = { ...order } as Record<string, unknown>;
  if (!can.profit) {
    for (const f of ORDER_PROFIT_FIELDS) if (f in out) out[f] = out[f] == null ? null : 0;
    out.profit_hidden = true;
  }
  if (!can.cost) {
    for (const f of ORDER_COST_FIELDS) if (f in out) out[f] = out[f] == null ? null : 0;
    if (Array.isArray(out.suppliers)) {
      out.suppliers = (out.suppliers as Record<string, unknown>[]).map((s) => {
        const line = { ...s };
        for (const f of ORDER_SUPPLIER_COST_FIELDS) if (f in line) line[f] = line[f] == null ? null : 0;
        return line;
      });
    }
    out.cost_hidden = true;
  }
  return out as T;
}

/** The finance screens that ARE profit and cash — the intelligence dashboard
 *  and the financial statements — open only with «Bank & Profit». A per-field
 *  mask would leave their alert engines reading zeros as facts ("every
 *  account near overdraft"), so the whole door closes instead. */
export async function requireBankAndProfit(auth: ServerAuthContext, what: string): Promise<NextResponse | null> {
  if (await canSeeBankAndProfit(auth)) return null;
  return NextResponse.json(
    { error: `${what} need «Bank & Profit» in Roles & Permissions.`, code: "needs_bank_profit" },
    { status: 403 },
  );
}

export interface UserExperience {
  account_id: string;
  can_see_cost_data: boolean;
  can_see_bank_balances: boolean;
  can_see_profit: boolean;
  can_approve: boolean;
  is_super_admin: boolean;
}

/** Every answer at once, for GET /api/me/preferences. A route asks only for
 *  what it uses: cost is free, each capability is one requireModuleAccess
 *  (none for a super admin). */
export async function getUserExperience(auth: ServerAuthContext): Promise<UserExperience> {
  const [bankAndProfit, approve] = await Promise.all([
    canSeeBankAndProfit(auth),
    canApproveFinance(auth),
  ]);
  return {
    account_id: auth.account_id,
    can_see_cost_data: canSeeCostData(auth),
    can_see_bank_balances: bankAndProfit,
    can_see_profit: bankAndProfit,
    can_approve: approve,
    is_super_admin: auth.is_super_admin,
  };
}
