import "server-only";

/* ---------------------------------------------------------------------------
   ai-agent/permissions — the single point of truth for what a user is
   allowed to see or do via Koleex AI.

   Design rules:
   - The LLM is never trusted. These functions run in server code before
     any data reaches the model or the user.
   - "Module" access mirrors the Hub's existing koleex_permissions /
     account_permission_overrides tables — same rules as every other
     Koleex API, so we can't accidentally make AI more permissive than
     a direct UI click.
   - "Sensitive fields" is a stricter, explicit allowlist. Even if a
     user can view the Products module they do NOT get cost_price unless
     they are on `can_view_private` OR super-admin. Same idea for
     margins, salaries, landed cost, supplier prices, bank details etc.
   - Every check returns a typed PermissionDecision, so the tool layer
     can translate denials into safe "I can't tell you that" responses
     instead of leaking details through error messages.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "../supabase-server";
import type { ServerAuthContext } from "../auth";
import type { UserContext, ToolAction, PermissionStatus } from "./types";

/* ─────────────────────────────────────────────────────────────────────
   Sensitive field allowlist.

   Each entry is "<entity>.<field>" — a canonical id used by tools when
   they filter output. Mapped to who may see it.

   Keep this list exhaustive and conservative: if you're not sure, add
   the field here and gate it behind can_view_private.
   ───────────────────────────────────────────────────────────────────── */

export const SENSITIVE_FIELDS: Record<string, {
  /** If true, only super-admins see it. */
  superAdminOnly?: boolean;
  /** If true, users with `can_view_private` see it. Super-admins always do. */
  requiresViewPrivate?: boolean;
  /** Plain-English name used when explaining why it was hidden. */
  label: string;
}> = {
  /* Products — cost side */
  "products.cost_price":        { requiresViewPrivate: true, label: "product cost price" },
  "products.supplier_price":    { requiresViewPrivate: true, label: "supplier purchase price" },
  "products.landed_cost":       { requiresViewPrivate: true, label: "landed cost breakdown" },
  "products.margin":            { requiresViewPrivate: true, label: "product margin" },
  "products.internal_notes":    { requiresViewPrivate: true, label: "internal product notes" },

  /* Quotations / invoices — margin side */
  "quotations.cost_total":      { requiresViewPrivate: true, label: "quotation cost total" },
  "quotations.margin_percent":  { requiresViewPrivate: true, label: "quotation margin percent" },
  "quotations.internal_notes":  { requiresViewPrivate: true, label: "internal quotation notes" },
  "invoices.cost_total":        { requiresViewPrivate: true, label: "invoice cost total" },
  "invoices.margin_percent":    { requiresViewPrivate: true, label: "invoice margin percent" },

  /* Customers / suppliers — commercial side */
  "customers.credit_limit":     { requiresViewPrivate: true, label: "customer credit limit" },
  "customers.payment_terms":    { requiresViewPrivate: true, label: "customer payment terms" },
  "customers.internal_notes":   { requiresViewPrivate: true, label: "internal customer notes" },
  "suppliers.bank_details":     { superAdminOnly: true,      label: "supplier bank details" },
  "suppliers.internal_notes":   { requiresViewPrivate: true, label: "internal supplier notes" },

  /* HR — always super-admin */
  "employees.salary":           { superAdminOnly: true, label: "employee salary" },
  "employees.bonus":            { superAdminOnly: true, label: "employee bonus" },
  "employees.bank_details":     { superAdminOnly: true, label: "employee bank details" },
  "employees.contract":         { superAdminOnly: true, label: "employee contract" },

  /* Finance / governance */
  "finance.bank_accounts":      { superAdminOnly: true, label: "company bank accounts" },
  "approvals.rules":            { superAdminOnly: true, label: "approval rule configuration" },
};

/* ─────────────────────────────────────────────────────────────────────
   Build the UserContext once at the top of each /api/ai/agent request.
   Pulls role permissions + account overrides in a single round-trip so
   downstream tool calls hit an in-memory map instead of the DB.
   ───────────────────────────────────────────────────────────────────── */

export async function buildUserContext(auth: ServerAuthContext): Promise<UserContext> {
  const superAdmin = auth.is_super_admin === true;
  const canViewPrivate = auth.can_view_private === true || superAdmin;

  // Load everything this user is allowed to see, one DB round-trip each.
  const [rolePermsRes, overridesRes] = await Promise.all([
    auth.role_id
      ? supabaseServer
          .from("koleex_permissions")
          .select("module_name, can_view, can_create, can_edit, can_delete")
          .eq("role_id", auth.role_id)
      : Promise.resolve({ data: [] as Array<{
          module_name: string; can_view: boolean; can_create: boolean;
          can_edit: boolean; can_delete: boolean;
        }>, error: null }),
    supabaseServer
      .from("account_permission_overrides")
      .select("module_key, can_view, can_create, can_edit, can_delete")
      .eq("account_id", auth.account_id),
  ]);

  const modulePermissions: UserContext["modulePermissions"] = {};

  if (superAdmin) {
    // Short-circuit: super-admin gets a permissive record for any module
    // lookup. The tools don't enumerate — they just ask "does X allow
    // view?" and the code path below returns true.
  } else {
    for (const row of rolePermsRes.data ?? []) {
      modulePermissions[row.module_name.toLowerCase()] = {
        can_view: row.can_view ?? false,
        can_create: row.can_create ?? false,
        can_edit: row.can_edit ?? false,
        can_delete: row.can_delete ?? false,
      };
    }
    // Account-level overrides win (same rule as Hub APIs): a hide
    // override beats a role grant, but a grant override does not beat a
    // role denial — only admins toggle overrides.
    for (const ov of overridesRes.data ?? []) {
      const key = ov.module_key.toLowerCase();
      const existing = modulePermissions[key] ?? {
        can_view: false, can_create: false, can_edit: false, can_delete: false,
      };
      modulePermissions[key] = {
        can_view: ov.can_view === false ? false : existing.can_view,
        can_create: ov.can_create === false ? false : existing.can_create,
        can_edit: ov.can_edit === false ? false : existing.can_edit,
        can_delete: ov.can_delete === false ? false : existing.can_delete,
      };
    }
  }

  // Compute allowed-sensitive-field set once.
  const allowedSensitiveFields = new Set<string>();
  for (const [fieldId, rule] of Object.entries(SENSITIVE_FIELDS)) {
    if (rule.superAdminOnly && superAdmin) {
      allowedSensitiveFields.add(fieldId);
    } else if (!rule.superAdminOnly && (rule.requiresViewPrivate ? canViewPrivate : true)) {
      allowedSensitiveFields.add(fieldId);
    }
  }

  return {
    auth,
    modulePermissions,
    allowedSensitiveFields,
    department: auth.department,
    isSuperAdmin: superAdmin,
    canViewPrivate,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   Runtime guards.

   These are the ONLY places where the agent is allowed to make an
   access decision. Tools call these; the LLM never sees the boolean
   directly — it gets a ToolResult envelope with permissionStatus.
   ───────────────────────────────────────────────────────────────────── */

export interface PermissionDecision {
  allowed: boolean;
  status: PermissionStatus;
  /** Short user-facing reason if denied. Never includes restricted
   *  values — only the shape of the denial (module, action). */
  reason?: string;
}

export function checkModule(
  ctx: UserContext,
  moduleName: string,
  action: ToolAction = "view",
): PermissionDecision {
  if (ctx.isSuperAdmin) return { allowed: true, status: "allowed" };

  const perms = ctx.modulePermissions[moduleName.toLowerCase()];
  if (!perms) {
    return {
      allowed: false,
      status: "denied",
      reason: `You don't have access to the ${moduleName} module.`,
    };
  }

  const key: keyof typeof perms = ({
    view: "can_view",
    create: "can_create",
    edit: "can_edit",
    delete: "can_delete",
  } as const)[action];

  if (!perms[key]) {
    return {
      allowed: false,
      status: "denied",
      reason: `You don't have permission to ${action} in ${moduleName}.`,
    };
  }

  return { allowed: true, status: "allowed" };
}

export function checkField(ctx: UserContext, fieldId: string): boolean {
  // If the field isn't sensitive at all, it's always allowed.
  if (!(fieldId in SENSITIVE_FIELDS)) return true;
  return ctx.allowedSensitiveFields.has(fieldId);
}

/* ─────────────────────────────────────────────────────────────────────
   Field filter — strip restricted fields from an object before returning
   it to the caller OR passing it to the LLM.

   Returns both the filtered object AND the list of stripped fields so
   the UI can display a "limited" label when relevant.

   `entity` is the canonical prefix (e.g. "products"); any key matching
   "<entity>.<key>" in SENSITIVE_FIELDS that the user isn't allowed to
   see is removed.
   ───────────────────────────────────────────────────────────────────── */

export function filterFields<T extends Record<string, unknown>>(
  ctx: UserContext,
  entity: string,
  record: T,
): { filtered: Partial<T>; stripped: string[] } {
  const filtered: Partial<T> = {};
  const stripped: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    const fieldId = `${entity}.${key}`;
    if (fieldId in SENSITIVE_FIELDS && !checkField(ctx, fieldId)) {
      stripped.push(fieldId);
      continue;
    }
    (filtered as Record<string, unknown>)[key] = value;
  }
  return { filtered, stripped };
}

export function filterFieldsMany<T extends Record<string, unknown>>(
  ctx: UserContext,
  entity: string,
  records: T[],
): { filtered: Array<Partial<T>>; stripped: string[] } {
  const strippedSet = new Set<string>();
  const filtered = records.map((r) => {
    const res = filterFields(ctx, entity, r);
    res.stripped.forEach((f) => strippedSet.add(f));
    return res.filtered;
  });
  return { filtered, stripped: [...strippedSet] };
}
