import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/me/permitted-modules
   Returns the Set of module_names the caller is allowed to view, after
   applying: SA bypass, role permissions, account-level overrides, and
   the always-allowed Type C / Dashboard modules.

   Used by the Sidebar and the dashboard App Launcher to hide apps the
   caller can't access. Replaces the client-side anon-key reads of
   koleex_permissions + account_permission_overrides, which are now
   closed behind RLS. */

const TYPE_C_MODULES = ["Calendar", "To-do", "Koleex Mail", "Inbox"];

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // Super Admin: return every module referenced anywhere in
  // koleex_permissions plus an alias list for admin-only surfaces
  // (Roles & Permissions, Settings, etc.) handled on the client side.
  if (auth.is_super_admin) {
    const { data } = await supabaseServer
      .from("koleex_permissions")
      .select("module_name");
    const set = new Set<string>(
      (data ?? []).map((r) => (r as { module_name: string }).module_name),
    );
    return NextResponse.json({ modules: Array.from(set), is_super_admin: true });
  }

  if (!auth.role_id) {
    return NextResponse.json({
      modules: [...TYPE_C_MODULES, "Dashboard"],
      is_super_admin: false,
    });
  }

  // Fetch both the role's baseline perms AND every override row for
  // this account. We handle ADDS (override grants what role denies)
  // and REMOVES (override hides what role grants) in one pass below.
  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    supabaseServer
      .from("koleex_permissions")
      .select("module_name")
      .eq("role_id", auth.role_id)
      .eq("can_view", true),
    supabaseServer
      .from("account_permission_overrides")
      .select("module_key, can_view")
      .eq("account_id", auth.account_id),
  ]);

  const allowed = new Set<string>(
    (rolePerms ?? []).map((r) => (r as { module_name: string }).module_name),
  );
  for (const m of TYPE_C_MODULES) allowed.add(m);
  allowed.add("Dashboard");

  for (const o of overrides ?? []) {
    const row = o as { module_key: string; can_view: boolean };
    if (row.can_view) {
      // Override grants what role doesn't — add it.
      allowed.add(row.module_key);
    } else {
      // Override hides what role grants — remove it.
      allowed.delete(row.module_key);
    }
  }

  return NextResponse.json({
    modules: Array.from(allowed),
    is_super_admin: false,
  });
}
