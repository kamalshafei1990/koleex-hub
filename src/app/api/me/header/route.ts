import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/me/header
   Returns the full account-with-joins shape the header component needs:
   avatar_url, username, user_type, person { full_name, avatar_url },
   role { id, name }. Used by useCurrentAccount() — previously read from
   the accounts/people/roles tables via the anon client, which is now
   closed behind RLS. */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("accounts")
    .select(
      `id, username, user_type, avatar_url, status,
       person_id, company_id, role_id, contact_id, tenant_id,
       login_email, force_password_change, two_factor_enabled,
       last_login_at, created_at, updated_at, is_super_admin,
       preferences,
       person:people(id, full_name, email, avatar_url, first_name, last_name, phone, job_title, country, city, language),
       role:roles(id, name, is_super_admin, can_view_private, description, display_order)`,
    )
    .eq("id", auth.account_id)
    .maybeSingle();

  if (error || !data) {
    console.error("[api/me/header]", error?.message);
    return NextResponse.json({ error: "Failed to load account" }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}
