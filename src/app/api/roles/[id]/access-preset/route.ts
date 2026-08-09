import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* GET /api/roles/[id]/access-preset
   The default module access a role grants, shown in the account form so an
   admin can see what a role gives before assigning it.

   `access_presets` has RLS on with no policy for anon, so the browser query
   this replaces returned null every time and the form fell back to showing
   nothing. Read-only, and gated on the Accounts module — the same gate that
   protects the form it feeds. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: roleId } = await params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Accounts");
  if (deny) return deny;

  /* The account form asks two questions about a role at the same moment —
     "what preset does it carry" and "which modules does it grant" — so both
     answers travel together rather than as two round trips. */
  const [presetRes, modulesRes] = await Promise.all([
    supabaseServer.from("access_presets").select("*").eq("role_id", roleId).maybeSingle(),
    supabaseServer
      .from("koleex_permissions")
      .select("module_name, can_view")
      .eq("role_id", roleId)
      .eq("can_view", true)
      .order("module_name", { ascending: true }),
  ]);

  if (presetRes.error) {
    console.error("[api/roles/access-preset] preset:", presetRes.error.message);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
  if (modulesRes.error) {
    console.error("[api/roles/access-preset] modules:", modulesRes.error.message);
  }

  const grantedModules = ((modulesRes.data ?? []) as { module_name: string }[])
    .map((r) => r.module_name);

  return NextResponse.json({ preset: presetRes.data ?? null, grantedModules });
}
