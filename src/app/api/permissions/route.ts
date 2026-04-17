import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* GET /api/permissions?role_id=X   — list perm rows for a role
   PUT /api/permissions              — upsert (role_id + array of perms)

   Reading is allowed for any authenticated user in the tenant — various
   pickers and gates need it. Writing requires Super Admin. */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const roleId = new URL(req.url).searchParams.get("role_id");
  if (!roleId) {
    return NextResponse.json(
      { error: "role_id is required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseServer
    .from("koleex_permissions")
    .select("*")
    .eq("role_id", roleId)
    .order("module_name", { ascending: true });
  if (error) {
    console.error("[api/permissions GET]", error.message);
    return NextResponse.json({ error: "Failed to load perms" }, { status: 500 });
  }
  return NextResponse.json({ permissions: data ?? [] });
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    role_id: string;
    permissions: Array<{
      module_name: string;
      can_view: boolean;
      can_create: boolean;
      can_edit: boolean;
      can_delete: boolean;
      data_scope?: string;
    }>;
  };

  const rows = body.permissions.map((p) => ({
    role_id: body.role_id,
    module_name: p.module_name,
    can_view: p.can_view,
    can_create: p.can_create,
    can_edit: p.can_edit,
    can_delete: p.can_delete,
    data_scope: p.data_scope ?? "all",
  }));

  const { error } = await supabaseServer
    .from("koleex_permissions")
    .upsert(rows, { onConflict: "role_id,module_name" });
  if (error) {
    console.error("[api/permissions PUT]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
