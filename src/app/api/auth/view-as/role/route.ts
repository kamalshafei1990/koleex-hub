import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { setViewAsRoleCookie } from "@/lib/server/session";
import { supabaseServer } from "@/lib/server/supabase-server";

/* ---------------------------------------------------------------------------
   POST /api/auth/view-as/role

   Super-admin only. Body: { roleId: string }.
   Mints the `koleex_view_as_role` cookie so every subsequent request
   evaluates permissions as if the SA had only that role's grants. The
   SA's own account / tenant stays loaded — only the role swaps and
   is_super_admin is forced off.

   Sibling to /api/auth/view-as (which view-as's a specific account).
   The two cookies are mutually exclusive — minting this one clears the
   account-mode cookie at the session-layer write.

   Read-only enforcement: while either cookie is active, requireAuth(req)
   blocks non-GET requests.

   Audit: every enter/deny logged to koleex_security_audit, action
   "view_as.enter_role" / "view_as.denied_role".
   --------------------------------------------------------------------------- */

interface Body {
  roleId?: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (auth.viewing_as) {
    return NextResponse.json(
      { error: "Already viewing as another user/role. Exit first." },
      { status: 409 },
    );
  }

  if (!auth.is_super_admin) {
    await supabaseServer.from("koleex_security_audit").insert({
      actor_account_id: auth.account_id,
      action: "view_as.denied_role",
      ip: ipFor(req),
      user_agent: req.headers.get("user-agent") ?? null,
    });
    return NextResponse.json(
      { error: "Only super admins can view as a role." },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const roleId = typeof body.roleId === "string" ? body.roleId : "";
  if (!UUID_RE.test(roleId)) {
    return NextResponse.json({ error: "roleId must be a UUID" }, { status: 400 });
  }
  if (roleId === auth.role_id) {
    return NextResponse.json(
      { error: "That role is already yours." },
      { status: 400 },
    );
  }

  /* Verify the role exists. Roles are global (no tenant_id), so any
     SA can preview any role. Block previewing a super-admin role —
     defeats the purpose (no perms get filtered). */
  const { data: role, error } = await supabaseServer
    .from("roles")
    .select("id, name, is_super_admin")
    .eq("id", roleId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!role) {
    return NextResponse.json({ error: "Role not found." }, { status: 404 });
  }
  if (role.is_super_admin) {
    return NextResponse.json(
      { error: "Cannot view as another super admin role — it grants everything." },
      { status: 400 },
    );
  }

  await setViewAsRoleCookie(roleId, auth.account_id);

  await supabaseServer.from("koleex_security_audit").insert({
    actor_account_id: auth.account_id,
    action: "view_as.enter_role",
    ip: ipFor(req),
    user_agent: req.headers.get("user-agent") ?? null,
    details: { target_role_id: roleId, target_role_name: role.name },
  });

  return NextResponse.json({
    ok: true,
    targetRoleId: roleId,
    targetRoleName: role.name,
  });
}

function ipFor(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
