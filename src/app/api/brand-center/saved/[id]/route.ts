import "server-only";

/* /api/brand-center/saved/<id> — change or remove a saved template.
   Only its owner (or a super admin) may; making it shared with the company
   needs the Brand Center "create" right.
   PATCH { name?, fill?, shared? } · DELETE */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, type ServerAuthContext } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { text } from "@/lib/server/brand-center/library";
import { SAVED_COLUMNS, cleanFill } from "@/lib/server/brand-center/saved";

export const dynamic = "force-dynamic";

async function own(auth: ServerAuthContext, id: string) {
  const { data } = await supabaseServer.from("brand_saved_templates").select("id, account_id")
    .eq("tenant_id", auth.tenant_id).eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (data.account_id !== auth.account_id && !auth.is_super_admin) return NextResponse.json({ error: "not_yours" }, { status: 403 });
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;
  const { id } = await params;
  const notOwn = await own(auth, id);
  if (notOwn) return notOwn;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.name !== undefined) {
    const name = text(body.name, 80);
    if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
    patch.name = name;
  }
  if (body?.fill !== undefined) {
    const fill = cleanFill(body.fill);
    if (!fill) return NextResponse.json({ error: "fill_too_big" }, { status: 413 });
    patch.fill = fill;
  }
  if (typeof body?.shared === "boolean") {
    if (body.shared) {
      const noShare = await brandCenterGate(auth, "create");
      if (noShare) return noShare;
    }
    patch.shared = body.shared;
  }
  const { data, error } = await supabaseServer.from("brand_saved_templates").update(patch)
    .eq("tenant_id", auth.tenant_id).eq("id", id).select(SAVED_COLUMNS).single();
  if (error) {
    console.error("[api/brand-center/saved PATCH]", error.message);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ saved: { ...data, mine: data.account_id === auth.account_id } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;
  const { id } = await params;
  const notOwn = await own(auth, id);
  if (notOwn) return notOwn;
  const { error } = await supabaseServer.from("brand_saved_templates").delete().eq("tenant_id", auth.tenant_id).eq("id", id);
  if (error) {
    console.error("[api/brand-center/saved DELETE]", error.message);
    return NextResponse.json({ error: "Could not remove." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
