import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { getServerAuth } from "@/lib/server/auth";
import { getSessionAccountId, getViewAsAccountId, getViewAsRoleId } from "@/lib/server/session";

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
  const realAccountId = await getSessionAccountId();
  if (!realAccountId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Determine view-as targets synchronously from session cookies
  const overrideTargetAccountId = await getViewAsAccountId(realAccountId);
  const overrideTargetRoleId = overrideTargetAccountId ? null : await getViewAsRoleId(realAccountId);
  
  const accountIdToLoad = overrideTargetAccountId ?? realAccountId;
  const roleMode = !!(overrideTargetRoleId && !overrideTargetAccountId);

  // Run ALL database queries strictly in parallel. 
  // By querying accounts + embedded roles/permissions alongside getServerAuth, 
  // we eliminate the sequential waterfall entirely (2 round trips -> 1 round trip).
  const [auth, headerRes, overridesRes, targetRoleLabelRes] = await Promise.all([
    getServerAuth(),
    supabaseServer
      .from("accounts")
      .select(
        `id, username, user_type, avatar_url, status, person_id, company_id,
         role_id, contact_id, tenant_id, login_email, force_password_change,
         two_factor_enabled, last_login_at, created_at, updated_at,
         is_super_admin, preferences,
         person:people(id, full_name, email, avatar_url, first_name, last_name, phone, job_title, country, city, language),
         role:roles(id, name, is_super_admin, can_view_private, description, display_order, koleex_permissions(module_name, can_view))`
      )
      .eq("id", accountIdToLoad)
      .maybeSingle(),
    /* Fetch overrides for everyone (since we don't know SA status until auth resolves).
       We will filter them out in JS if the user is a super admin. */
    roleMode
      ? Promise.resolve({ data: [] as Array<{ module_key: string; can_view: boolean }> })
      : supabaseServer
          .from("account_permission_overrides")
          .select("module_key, can_view")
          .eq("account_id", accountIdToLoad),
    overrideTargetRoleId
      ? supabaseServer
          .from("roles")
          .select("id, name, koleex_permissions(module_name, can_view)")
          .eq("id", overrideTargetRoleId)
          .maybeSingle()
      : Promise.resolve(null),
  ]);

  if (!auth) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Build permitted modules set.
  const allowed = new Set<string>();
  
  // Helper to extract permissions from embedded role relation
  const extractPerms = (r: unknown) => {
    if (!r || typeof r !== 'object') return;
    const rd = r as { koleex_permissions?: Array<{ module_name: string; can_view: boolean }> | { module_name: string; can_view: boolean } | null };
    if (!rd.koleex_permissions) return;
    const perms = Array.isArray(rd.koleex_permissions) ? rd.koleex_permissions : [rd.koleex_permissions];
    for (const p of perms) {
      if (p.can_view) allowed.add(p.module_name);
    }
  };

  // If super admin, they get all modules from the koleex_permissions table (exactly like old behavior).
  if (auth.is_super_admin) {
    const allPermsRes = await supabaseServer.from("koleex_permissions").select("module_name");
    for (const r of allPermsRes.data ?? []) {
      allowed.add((r as { module_name: string }).module_name);
    }
  } else if (roleMode && targetRoleLabelRes?.data) {
    // If role-mode view-as, use the target role's permissions.
    extractPerms(targetRoleLabelRes.data);
  } else if (headerRes?.data?.role) {
    // Otherwise use the account's role permissions.
    extractPerms(headerRes.data.role);
  }

  for (const m of TYPE_C_MODULES) allowed.add(m);
  allowed.add("Dashboard");

  if (!auth.is_super_admin) {
    for (const o of overridesRes.data ?? []) {
      const row = o as { module_key: string; can_view: boolean };
      if (row.can_view) allowed.add(row.module_key);
      else allowed.delete(row.module_key);
    }
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

  /* Cache aggressively when NOT viewing-as — payload barely changes
     during a normal session (role / perms / dept / tenant are admin-
     edited once in a while). When viewing-as IS active, use a SHORT
     cache (10s) instead of no-store: every navigation inside view-as
     was previously hitting the DB, which made the mode feel sluggish.
     The 10s window is short enough that exits / re-picks (which call
     retryMeBootstrap with cache:no-store) still feel instant. */
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": viewingAs
        ? "private, max-age=10, stale-while-revalidate=30"
        : "private, max-age=60, stale-while-revalidate=300",
    },
  });
}
