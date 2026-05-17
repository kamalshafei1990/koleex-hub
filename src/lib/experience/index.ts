import "server-only";

/* ===========================================================================
   Experience layer — role-based dashboards + visibility gating.

   The brief is strict: no new RBAC system. We piggyback on the existing
   `accounts.preferences` JSONB column to store a small per-user shape:

       {
         dashboard_role : DashboardRole,    // CEO / Accountant / Sales / …
         ui_mode        : "simple" | "advanced",
         favorite_apps  : string[],         // app ids from APP_REGISTRY
         pinned_workflows: WorkflowKey[],
       }

   When the user hasn't picked anything yet we derive a sensible default
   from their existing role + employee department:

     · is_super_admin            → "ceo"
     · koleex_employees.department matched against keywords
                                  → matching role
     · everything else           → "ceo"  (safe fallback — they see
                                   high-level data, not raw operations)

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
  | "purchasing" | "marketing" | "hr";

export type UiMode = "simple" | "advanced";

export const ALL_DASHBOARD_ROLES: DashboardRole[] = [
  "ceo", "accountant", "sales", "warehouse",
  "purchasing", "marketing", "hr",
];

export interface UserExperience {
  account_id: string;
  dashboard_role: DashboardRole;
  ui_mode: UiMode;
  favorite_apps: string[];
  pinned_workflows: string[];
  /** True when the dashboard_role + role_id together qualify the user
   *  to see financial cost data. */
  can_see_cost_data: boolean;
  can_see_bank_balances: boolean;
  can_see_profit: boolean;
  /** True when the underlying role grants is_super_admin. Bypass for
   *  visibility checks. */
  is_super_admin: boolean;
}

interface PreferencesBlob {
  dashboard_role?: DashboardRole;
  ui_mode?: UiMode;
  favorite_apps?: string[];
  pinned_workflows?: string[];
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
  return "ceo";   // safe high-level default
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
  const { data: row } = await supabaseServer
    .from("accounts")
    .select("id, preferences, is_super_admin")
    .eq("id", auth.account_id)
    .maybeSingle();
  const prefs = ((row as { preferences: PreferencesBlob | null } | null)?.preferences ?? {}) as PreferencesBlob;
  const isSuperAdmin = !!auth.is_super_admin || !!(row as { is_super_admin: boolean } | null)?.is_super_admin;

  const role: DashboardRole = (prefs.dashboard_role && ALL_DASHBOARD_ROLES.includes(prefs.dashboard_role))
    ? prefs.dashboard_role
    : inferDashboardRole(auth.department, isSuperAdmin);
  const uiMode: UiMode = prefs.ui_mode === "advanced" ? "advanced" : "simple";

  return {
    account_id: auth.account_id,
    dashboard_role: role,
    ui_mode: uiMode,
    favorite_apps: Array.isArray(prefs.favorite_apps) ? prefs.favorite_apps.slice(0, 12) : [],
    pinned_workflows: Array.isArray(prefs.pinned_workflows) ? prefs.pinned_workflows.slice(0, 8) : [],
    can_see_cost_data: canSeeCostData(role, isSuperAdmin),
    can_see_bank_balances: canSeeBankBalances(role, isSuperAdmin),
    can_see_profit: canSeeProfit(role, isSuperAdmin),
    is_super_admin: isSuperAdmin,
  };
}

/* ─── Patch helper ─────────────────────────────────────────── */

export interface PreferencesPatch {
  dashboard_role?: DashboardRole;
  ui_mode?: UiMode;
  favorite_apps?: string[];
  pinned_workflows?: string[];
}

export async function updateUserPreferences(
  accountId: string,
  patch: PreferencesPatch,
): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error: readErr } = await supabaseServer
    .from("accounts")
    .select("preferences")
    .eq("id", accountId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  const current = ((row as { preferences: PreferencesBlob | null } | null)?.preferences ?? {}) as PreferencesBlob;

  const next: PreferencesBlob = { ...current };
  if (patch.dashboard_role && ALL_DASHBOARD_ROLES.includes(patch.dashboard_role)) {
    next.dashboard_role = patch.dashboard_role;
  }
  if (patch.ui_mode === "simple" || patch.ui_mode === "advanced") {
    next.ui_mode = patch.ui_mode;
  }
  if (Array.isArray(patch.favorite_apps)) {
    next.favorite_apps = patch.favorite_apps.slice(0, 12);
  }
  if (Array.isArray(patch.pinned_workflows)) {
    next.pinned_workflows = patch.pinned_workflows.slice(0, 8);
  }

  const { error } = await supabaseServer
    .from("accounts")
    .update({ preferences: next })
    .eq("id", accountId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
