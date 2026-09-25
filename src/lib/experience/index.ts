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
