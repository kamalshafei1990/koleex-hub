/* ---------------------------------------------------------------------------
   customer-quotation-guard — CQE (Customer-only Quotations Enforcement).

   A NARROW, real-enforcement layer that hides quotations from EXTERNAL
   (customer) accounts unless they created the row. Completely separate from
   the DS1 shadow system (apply-scope.ts / SCOPE_MODE_QUOTATIONS), which stays
   shadow-only / off for internal users and is untouched here.

   Rule (business-confirmed, urgent-safe):
     An external customer account may see a quotation ONLY IF
       quotation.created_by = auth.account_id
     → hides internal/Super-Admin-created quotes AND null-owner quotes.
     (No customer_id / company / contact matching — no reliable bridge yet.)

   Activation (ALL must hold for a request to be enforced):
     1. env CUSTOMER_QUOTATIONS_ENFORCE = "true"   (default off)
     2. account is NOT super-admin
     3. account is external: user_type='customer' OR its role.scope='customer'

   When the flag is OFF (default + current production), isCustomerEnforced()
   returns false IMMEDIATELY with NO database read → zero overhead and zero
   behaviour change for everyone (internal, SA, customer). CQE is fully inert
   until the flag is explicitly set.

   PURE-ish: no "server-only", no Supabase import — the DB client is injected,
   so the pure parts are unit-testable in plain Node.
   --------------------------------------------------------------------------- */

/** Auth shape this guard needs (structural subset of ServerAuthContext). */
export interface CqeAuth {
  account_id: string;
  is_super_admin: boolean;
  role_id?: string | null;
}

/** Minimal injected DB shape (the real Supabase service client satisfies it). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CqeDb = { from: (table: string) => any };

/** Is the CUSTOMER_QUOTATIONS_ENFORCE flag on? Default OFF. */
export function customerQuotationsEnforceEnabled(): boolean {
  return (process.env.CUSTOMER_QUOTATIONS_ENFORCE ?? "").trim().toLowerCase() === "true";
}

/** Pure: does this account own the quotation row? created_by-only. */
export function ownsQuotation(
  row: { created_by?: string | null } | null | undefined,
  accountId: string,
): boolean {
  return !!row && row.created_by != null && row.created_by === accountId;
}

/**
 * Should CQE enforce ownership for THIS request?
 *   flag ON  &&  NOT super-admin  &&  external (user_type='customer' OR role.scope='customer').
 *
 * Flag OFF → returns false with NO DB read (inert). Super-admin → false (no DB read).
 * DB errors propagate (fail-safe: the route 500s rather than guessing the
 * wrong side — never silently exposes customer data, never silently hides
 * internal data).
 */
export async function isCustomerEnforced(auth: CqeAuth, db: CqeDb): Promise<boolean> {
  if (!customerQuotationsEnforceEnabled()) return false; // inert when off — no DB read
  if (auth.is_super_admin) return false;

  const { data: acct } = await db
    .from("accounts")
    .select("user_type, role_id")
    .eq("id", auth.account_id)
    .maybeSingle();
  if (!acct) return false;
  if (acct.user_type === "customer") return true;

  const roleId = (acct.role_id ?? auth.role_id) as string | null | undefined;
  if (roleId) {
    const { data: role } = await db.from("roles").select("scope").eq("id", roleId).maybeSingle();
    if (role?.scope === "customer") return true;
  }
  return false;
}
