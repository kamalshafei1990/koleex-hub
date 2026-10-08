import "server-only";

/* /api/brand-center/saved — "my templates" (owner 29/09/2026).
   GET ?template=<id>  → my saved fills of that template, the company's shared
                         ones, and whether I may share (Brand Center "create").
   POST { templateId, name, fill, shared } → save a new one. Anyone who can
                         open Brand Center keeps their own; sharing with the
                         company needs the "create" right. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { text } from "@/lib/server/brand-center/library";
import { SAVED_COLUMNS, cleanFill, isTemplateId } from "@/lib/server/brand-center/saved";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;
  const template = new URL(req.url).searchParams.get("template");
  if (!isTemplateId(template)) return NextResponse.json({ error: "template_required" }, { status: 400 });
  const { data, error } = await supabaseServer.from("brand_saved_templates").select(SAVED_COLUMNS)
    .eq("tenant_id", auth.tenant_id).eq("template_id", template)
    .or(`account_id.eq.${auth.account_id},shared.eq.true`)
    .order("updated_at", { ascending: false }).limit(200);
  if (error) {
    console.error("[api/brand-center/saved GET]", error.message);
    return NextResponse.json({ error: "Could not load saved templates." }, { status: 500 });
  }
  const canShare = !(await brandCenterGate(auth, "create"));
  const rows = (data ?? []).map((r) => ({ ...r, mine: r.account_id === auth.account_id }));
  return NextResponse.json({ canShare, saved: rows });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = text(body?.name, 80);
  const fill = cleanFill(body?.fill);
  if (!isTemplateId(body?.templateId) || !name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!fill) return NextResponse.json({ error: "fill_too_big" }, { status: 413 });
  const shared = body?.shared === true;
  if (shared) {
    const noShare = await brandCenterGate(auth, "create");
    if (noShare) return noShare;
  }
  const { data, error } = await supabaseServer.from("brand_saved_templates").insert({
    tenant_id: auth.tenant_id, account_id: auth.account_id, template_id: body!.templateId, name, fill, shared,
  }).select(SAVED_COLUMNS).single();
  if (error) {
    console.error("[api/brand-center/saved POST]", error.message);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ saved: { ...data, mine: true } });
}
