import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   GET /api/auth/view-as/users

   Returns the list of users the calling Super Admin can view-as: every
   active account in their tenant (except themselves). Service-role
   read because RLS on `accounts` correctly blocks the anon client
   from listing other accounts directly. Filtered + scoped to the SA's
   own tenant — cross-tenant view goes through the TenantPicker.
   --------------------------------------------------------------------------- */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super admins can list view-as candidates." },
      { status: 403 },
    );
  }

  const { data, error } = await supabaseServer
    .from("accounts")
    .select(`id, username, login_email, user_type, status, role_id,
             role:roles(name)`)
    .eq("tenant_id", auth.tenant_id)
    .eq("status", "active")
    .neq("id", auth.real_account_id ?? auth.account_id)
    .order("username", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accounts = ((data ?? []) as Array<Record<string, unknown>>).map((r) => {
    const role = r.role as { name?: string } | { name?: string }[] | null;
    const roleName = Array.isArray(role) ? role[0]?.name ?? null : role?.name ?? null;
    return {
      id: r.id as string,
      username: r.username as string,
      login_email: r.login_email as string,
      user_type: r.user_type as string,
      status: r.status as string,
      role_id: r.role_id as string | null,
      role_name: roleName,
    };
  });

  return NextResponse.json({ accounts });
}
