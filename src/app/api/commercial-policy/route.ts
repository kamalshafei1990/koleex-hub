import "server-only";

/* GET /api/commercial-policy
   Returns the full Commercial Policy snapshot for the caller's tenant.
   Gated to super_admin / admin / general_manager. Sales and other
   customer-facing roles must not see this; it exposes margin floors,
   discount approval chains, and commission rates.

   Phase 2: read-only. Write endpoints land in Phase 3. */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getPolicySnapshot } from "@/lib/server/commercial-policy";
import { supabaseServer } from "@/lib/server/supabase-server";

/** Role slugs allowed to view/edit the commercial policy. Kept narrow
 *  on purpose — everyone else gets a 403. Super Admin always allowed
 *  by the is_super_admin bypass. */
const POLICY_ADMIN_ROLES = new Set<string>([
  "super_admin",
  "admin",
  "general_manager",
]);

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const allowed = await callerHasPolicyAccess(auth.role_id, auth.is_super_admin);
  if (!allowed) {
    return NextResponse.json(
      { error: "Not authorised to view the commercial policy" },
      { status: 403 },
    );
  }

  const snapshot = await getPolicySnapshot(auth.tenant_id);
  return NextResponse.json(snapshot, {
    headers: {
      // Short browser cache; the admin app invalidates on save.
      "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
    },
  });
}

async function callerHasPolicyAccess(
  roleId: string | null,
  isSuperAdmin: boolean,
): Promise<boolean> {
  if (isSuperAdmin) return true;
  if (!roleId) return false;
  const { data } = await supabaseServer
    .from("roles")
    .select("slug")
    .eq("id", roleId)
    .maybeSingle();
  const slug = (data as { slug?: string } | null)?.slug;
  return !!slug && POLICY_ADMIN_ROLES.has(slug);
}
