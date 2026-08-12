import "server-only";

/* ===========================================================================
   Experience layer — role-based dashboards + visibility gating.

   dashboard_role is DERIVED, never chosen. It used to be read from
   `accounts.preferences.dashboard_role`, which the user could set themselves
   via PATCH /api/me/preferences with no permission check at all — and the same
   value gates cost prices, bank balances and profit below. Any employee could
   send one request making themselves "accountant" and unmask the lot. The
   preference is no longer read, the PATCH that wrote it is gone, and the only
   inputs now are is_super_admin and the HR department on the employee record:

     · is_super_admin            → "ceo"
     · koleex_employees.department matched against keywords
                                  → matching role
     · everything else           → "staff"

   THE DEFAULT USED TO BE "ceo", commented "safe fallback". It was the exact
   opposite: "ceo" is the role that sees EVERYTHING, so anyone whose department
   string failed to match a keyword was silently granted full financial
   visibility. "staff" carries no visibility at all — fail closed, not open.

   Visibility helpers expose a tiny set of booleans for sensitive fields
   so server handlers and client UIs can both gate consistently:

       canSeeCostData(role)           → cost prices, inventory value, COGS
       canSeeBankBalances(role)       → bank account balances, treasury
       canSeeProfit(role)             → P&L, gross profit, margins

   Visibility rules are intentionally simple — the brief says
   over-engineering is forbidden. Refine in a later phase if needed.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { ServerAuthContext } from "@/lib/server/auth";

export type DashboardRole =
  | "ceo" | "accountant" | "sales" | "warehouse"
  | "purchasing" | "marketing" | "hr"
  /** No department match. Deliberately carries NO visibility — it is the
   *  fail-closed default and appears in none of the *_VISIBLE sets below. */
  | "staff";

export interface UserExperience {
  account_id: string;
  dashboard_role: DashboardRole;
  /** True when the dashboard_role + role_id together qualify the user
   *  to see financial cost data. */
  can_see_cost_data: boolean;
  can_see_bank_balances: boolean;
  can_see_profit: boolean;
  /** True when the underlying role grants is_super_admin. Bypass for
   *  visibility checks. */
  is_super_admin: boolean;
}

/* ─── Role inference ───────────────────────────────────────── */

const DEPARTMENT_KEYWORDS: Array<[RegExp, DashboardRole]> = [
  [/\b(account|finance|book|treasur|controller)/i, "accountant"],
  [/\b(sales|commercial|revenue|account.*manager)/i, "sales"],
  [/\b(warehouse|inventory|stock|logistic|fulfil)/i, "warehouse"],
  [/\b(purchas|procure|buyer|sourcing)/i, "purchasing"],
  [/\b(market|brand|growth|content|seo|ad)/i, "marketing"],
  [/\b(hr|human|people|talent|recruit|payroll)/i, "hr"],
  [/\b(ceo|exec|director|founder|owner|manag)/i, "ceo"],
];

function inferDashboardRole(department: string | null, isSuperAdmin: boolean): DashboardRole {
  if (isSuperAdmin) return "ceo";
  if (department) {
    for (const [rx, role] of DEPARTMENT_KEYWORDS) if (rx.test(department)) return role;
  }
  return "staff";   // fail closed: no department match ⇒ no financial visibility
}

/* ─── Visibility ───────────────────────────────────────────── */

const COST_VISIBLE: ReadonlySet<DashboardRole> = new Set([
  "ceo", "accountant", "purchasing",
]);
const BANK_VISIBLE: ReadonlySet<DashboardRole> = new Set([
  "ceo", "accountant",
]);
const PROFIT_VISIBLE: ReadonlySet<DashboardRole> = new Set([
  "ceo", "accountant",
]);

export function canSeeCostData(role: DashboardRole, isSuperAdmin = false): boolean {
  return isSuperAdmin || COST_VISIBLE.has(role);
}
export function canSeeBankBalances(role: DashboardRole, isSuperAdmin = false): boolean {
  return isSuperAdmin || BANK_VISIBLE.has(role);
}
export function canSeeProfit(role: DashboardRole, isSuperAdmin = false): boolean {
  return isSuperAdmin || PROFIT_VISIBLE.has(role);
}

/* ─── Resolver ─────────────────────────────────────────────── */

export async function getUserExperience(auth: ServerAuthContext): Promise<UserExperience> {
  /* `preferences` is deliberately NOT selected. It still exists on the row and
     may still hold a stale dashboard_role written before this change — reading
     it is exactly the hole that was closed, so the column is not consulted. */
  const { data: row } = await supabaseServer
    .from("accounts")
    .select("id, is_super_admin")
    .eq("id", auth.account_id)
    .maybeSingle();
  const isSuperAdmin = !!auth.is_super_admin || !!(row as { is_super_admin: boolean } | null)?.is_super_admin;

  const role = inferDashboardRole(auth.department, isSuperAdmin);

  return {
    account_id: auth.account_id,
    dashboard_role: role,
    can_see_cost_data: canSeeCostData(role, isSuperAdmin),
    can_see_bank_balances: canSeeBankBalances(role, isSuperAdmin),
    can_see_profit: canSeeProfit(role, isSuperAdmin),
    is_super_admin: isSuperAdmin,
  };
}

/* The patch helper that used to live here (updateUserPreferences /
   PreferencesPatch) is gone. It accepted any dashboard_role with no permission
   check, and that value gates cost/bank/profit visibility above. Nothing
   writes accounts.preferences any more; the only other keys it carried
   (ui_mode, favorite_apps, pinned_workflows) were read exclusively by the
   /home role dashboard, which was removed in the same change. */
