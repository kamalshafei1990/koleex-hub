import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

/* PATCH /api/people/[id] — update a person row.
   Dual-use: a signed-in user may edit their OWN person profile (Settings
   self-service); editing anyone else's record is an Accounts-admin action. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Self-service exemption: allow editing your own linked person row.
  const { data: me } = await supabaseServer
    .from("accounts")
    .select("person_id")
    .eq("id", auth.account_id)
    .maybeSingle();
  const isSelf = (me as { person_id?: string | null } | null)?.person_id === id;
  if (!isSelf) {
    const deny = await requireModuleAction(auth, "Accounts", "edit");
    if (deny) return deny;
  }

  // Tenant check.
  let q = supabaseServer.from("people").select("id").eq("id", id);
  if (auth.tenant_id) q = q.eq("tenant_id", auth.tenant_id);
  const { data: existing } = await q.maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = (await req.json()) as Record<string, unknown>;
  delete patch.id;
  delete patch.tenant_id;

  const { error } = await supabaseServer
    .from("people")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[api/people/[id] PATCH]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
