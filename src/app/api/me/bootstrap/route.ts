import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getServerAuth } from "@/lib/server/auth";

/* GET /api/me/bootstrap
   Consolidates the three hot per-page /api/me/* lookups (context,
   header card, permitted-modules) into ONE round-trip. The client
   hooks read from a shared in-memory cache seeded by this endpoint,
   so a fresh navigation fires one request instead of 3–4.

   Shape:
     {
       auth: ServerAuthContext,
       header: AccountWithLinks-ish,
       permittedModules: string[],
       isSuperAdmin: boolean
     }
*/

const TYPE_C_MODULES = ["Calendar", "To-do", "Koleex Mail", "Inbox", "Notes"];

export async function GET() {
  const auth = await getServerAuth();
  if (!auth) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Run the three DB queries in parallel — same work as three separate
  // routes would do, but in one serverless invocation.
  const [headerRes, rolePermsRes, overridesRes] = await Promise.all([
    supabaseServer
      .from("accounts")
      .select(
        `id, username, user_type, avatar_url, status, person_id, company_id,
         role_id, contact_id, tenant_id, login_email, force_password_change,
         two_factor_enabled, last_login_at, created_at, updated_at,
         is_super_admin, preferences,
         person:people(id, full_name, email, avatar_url, first_name, last_name, phone, job_title, country, city, language),
         role:roles(id, name, is_super_admin, can_view_private, description, display_order)`,
      )
      .eq("id", auth.account_id)
      .maybeSingle(),
    auth.is_super_admin
      ? supabaseServer.from("koleex_permissions").select("module_name")
      : auth.role_id
        ? supabaseServer
            .from("koleex_permissions")
            .select("module_name")
            .eq("role_id", auth.role_id)
            .eq("can_view", true)
        : Promise.resolve({ data: [] as Array<{ module_name: string }> }),
    auth.is_super_admin
      ? Promise.resolve({ data: [] as Array<{ module_key: string; can_view: boolean }> })
      : supabaseServer
          .from("account_permission_overrides")
          .select("module_key, can_view")
          .eq("account_id", auth.account_id),
  ]);

  // Build permitted modules set.
  const allowed = new Set<string>(
    (rolePermsRes.data ?? []).map((r) =>
      (r as { module_name: string }).module_name,
    ),
  );
  for (const m of TYPE_C_MODULES) allowed.add(m);
  allowed.add("Dashboard");
  for (const o of overridesRes.data ?? []) {
    const row = o as { module_key: string; can_view: boolean };
    if (row.can_view) allowed.add(row.module_key);
    else allowed.delete(row.module_key);
  }

  const payload = {
    auth,
    header: headerRes.data ?? null,
    permittedModules: Array.from(allowed),
    isSuperAdmin: auth.is_super_admin,
  };

  /* Cache aggressively — bootstrap payload barely changes during a
     session (role / perms / dept / tenant are all admin-edited once
     in a while). Bumped from max-age=10 to match the 60 s client
     cache. stale-while-revalidate lets the browser serve the old
     response instantly while we refresh in the background. Writes
     that DO change perms call invalidateMeBootstrap() to force a
     re-fetch. */
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
    },
  });
}
