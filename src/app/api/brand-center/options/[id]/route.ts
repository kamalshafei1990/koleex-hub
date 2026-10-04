import "server-only";

/* PATCH /api/brand-center/options/<id> — { chosen?, label? } · "edit" */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { text } from "@/lib/server/brand-center/library";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "edit");
  if (deny) return deny;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const patch: Record<string, unknown> = {};
  if (typeof body?.chosen === "boolean") patch.chosen = body.chosen;
  if (body && "label" in body) { const v = text(body.label, 160); if (!v) return NextResponse.json({ error: "label_required" }, { status: 400 }); patch.label = v; }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing_to_change" }, { status: 400 });
  const { data, error } = await supabaseServer.from("brand_item_options").update(patch)
    .eq("tenant_id", auth.tenant_id).eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not save the choice." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
