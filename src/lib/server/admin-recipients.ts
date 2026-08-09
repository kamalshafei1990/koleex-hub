import "server-only";

/* Who inside Koleex receives a request that came from outside it.

   This lived inside the sign-in-help route until the membership form needed
   the same answer. Two copies of "who is an admin" is how the two lists drift
   apart, and the failure is silent: a request simply never reaches somebody.
   One implementation, imported by both. */

import { supabaseServer } from "@/lib/server/supabase-server";

/** An explicit allow-list, not a wildcard. A `%admin%` match also catches
 *  "Customer Admin", which is a CUSTOMER-side role — these requests carry a
 *  person's name, email and phone, and a customer's own admin has no business
 *  receiving one. `user_type = internal` is the second guard on the same idea. */
const INTERNAL_ADMIN_ROLES = ["Admin", "Super Admin"];

/** Is this account allowed to READ membership requests?
 *
 *  Deliberately the same predicate as the fan-out below: if a request lands in
 *  your mail you can open it, and if it does not, you cannot. Two different
 *  answers to "who reviews these" is how somebody ends up notified about an
 *  application they are then refused permission to read. */
export async function isReviewer(accountId: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from("accounts")
    .select("is_super_admin, reviews_membership_requests, user_type, status, roles:role_id ( name )")
    .eq("id", accountId)
    .maybeSingle();
  if (error || !data) return false;
  const a = data as {
    is_super_admin: boolean | null;
    reviews_membership_requests: boolean | null;
    user_type: string | null;
    status: string | null;
    roles: { name: string | null } | { name: string | null }[] | null;
  };
  if (a.user_type !== "internal" || a.status !== "active") return false;
  if (a.is_super_admin || a.reviews_membership_requests) return true;
  const role = Array.isArray(a.roles) ? a.roles[0] : a.roles;
  return INTERNAL_ADMIN_ROLES.includes(role?.name ?? "");
}

/** Every active internal Super Admin, every active internal account holding an
 *  internal admin role, and anyone a Super Admin has nominated by hand.
 *
 *  The nomination exists because the rota should not be a function of the org
 *  chart. Whoever actually reads these — a customer-service lead, one person
 *  in procurement — can be added without granting them the Admin role and
 *  everything else that comes with it. It is additive: nobody who qualifies by
 *  role stops receiving them.
 *
 *  Deduped: someone who is a Super Admin AND nominated must not get two
 *  copies of the same request. */
export async function adminRecipients(tag: string): Promise<string[]> {
  const ids = new Set<string>();

  /* Super Admin by flag, or nominated by one. `user_type = internal` is not
     optional on either: a request carries a person's name, email and phone,
     and no customer-side account may ever be nominated into that. */
  const { data: sa, error: saErr } = await supabaseServer
    .from("accounts")
    .select("id")
    .or("is_super_admin.eq.true,reviews_membership_requests.eq.true")
    .eq("user_type", "internal")
    .eq("status", "active");
  if (saErr) console.error(`[${tag}] super admins and nominees`, saErr.message);
  for (const r of (sa ?? []) as { id: string }[]) ids.add(r.id);

  const { data: roles, error: rErr } = await supabaseServer
    .from("roles")
    .select("id")
    .in("name", INTERNAL_ADMIN_ROLES);
  if (rErr) console.error(`[${tag}] roles`, rErr.message);
  const roleIds = ((roles ?? []) as { id: string }[]).map((r) => r.id);

  if (roleIds.length > 0) {
    const { data: admins, error: aErr } = await supabaseServer
      .from("accounts")
      .select("id")
      .in("role_id", roleIds)
      .eq("user_type", "internal")
      .eq("status", "active");
    if (aErr) console.error(`[${tag}] admin accounts`, aErr.message);
    for (const r of (admins ?? []) as { id: string }[]) ids.add(r.id);
  }

  return [...ids];
}
