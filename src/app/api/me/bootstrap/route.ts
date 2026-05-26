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

  /* In role-mode the SA is still themselves — but we want the HEADER
     row to reflect the target role too, so the picker / banner can
     show "Viewing as <role name>". Fetch the target role's display
     row in parallel. */
  const roleMode = auth.view_as_kind === "role";

  // Run the DB queries in parallel — same work as separate routes
  // would do, but in one serverless invocation.
  const [headerRes, rolePermsRes, overridesRes, targetRoleLabelRes] = await Promise.all([
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
    /* Skip account-level overrides in role-mode — by definition there's
       no specific target account, so any overrides on the SA's own
       account would taint the role preview. */
    auth.is_super_admin || roleMode
      ? Promise.resolve({ data: [] as Array<{ module_key: string; can_view: boolean }> })
      : supabaseServer
          .from("account_permission_overrides")
          .select("module_key, can_view")
          .eq("account_id", auth.account_id),
    auth.view_as_role_id
      ? supabaseServer
          .from("roles")
          .select("id, name")
          .eq("id", auth.view_as_role_id)
          .maybeSingle()
      : Promise.resolve(null),
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

  /* When the auth context is a view-as override, expose a `viewingAs`
     block so the client can render a banner and disable write
     affordances. Two flavours:
       · kind="account": `auth.account_id` is the TARGET user — the
         header lookup above loaded the target's account row.
       · kind="role":    `auth.account_id` is still the SA's own (the
         header row is the SA), but `auth.role_id` is the target role.
         We surface the role's name so the banner can read
         "Viewing as Sales Rep (role)" without an extra round-trip. */
  const headerRow = headerRes.data as
    | { username?: string | null; person?: { full_name?: string | null } | null }
    | null;
  const targetRoleLabel = targetRoleLabelRes && "data" in targetRoleLabelRes
    ? (targetRoleLabelRes.data as { id?: string; name?: string | null } | null)
    : null;
  const viewingAs = auth.viewing_as
    ? roleMode
      ? {
          kind: "role" as const,
          targetRoleId: auth.view_as_role_id,
          targetRoleName: targetRoleLabel?.name ?? null,
          realAccountId: auth.real_account_id,
        }
      : {
          kind: "account" as const,
          targetAccountId: auth.account_id,
          targetUsername: headerRow?.username ?? null,
          targetDisplayName: headerRow?.person?.full_name ?? headerRow?.username ?? null,
          realAccountId: auth.real_account_id,
        }
    : null;

  const payload = {
    auth,
    header: headerRes.data ?? null,
    permittedModules: Array.from(allowed),
    isSuperAdmin: auth.is_super_admin,
    viewingAs,
  };

  /* Cache aggressively when NOT viewing-as — bootstrap payload barely
     changes during a normal session (role / perms / dept / tenant are
     admin-edited once in a while). When viewing-as IS active, skip the
     cache so picker enter/exit takes effect immediately instead of
     waiting up to 60s for a fresh bootstrap. */
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": viewingAs
        ? "private, no-store"
        : "private, max-age=60, stale-while-revalidate=300",
    },
  });
}
