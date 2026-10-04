import "server-only";

/* /api/brand-center/styles — which template styles are approved, drafts or
   retired (owner, 30/09/2026: staff see only the approved look).
   GET ?template=<id> → { canManage, statuses: { style: status } } — a style
                        with no row is approved.
   PUT { templateId, style, status } → set one; the Brand Center "edit"
                        right (the owner, super admins). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { brandCenterGate } from "@/lib/server/brand-center/access";
import { isTemplateId } from "@/lib/server/brand-center/saved";

export const dynamic = "force-dynamic";

const STATUSES = ["approved", "draft", "retired"] as const;
const STYLE_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "view");
  if (deny) return deny;
  const template = new URL(req.url).searchParams.get("template");
  if (!isTemplateId(template)) return NextResponse.json({ error: "template_required" }, { status: 400 });
  const { data, error } = await supabaseServer.from("brand_template_styles").select("style, status")
    .eq("tenant_id", auth.tenant_id).eq("template_id", template);
  if (error) {
    console.error("[api/brand-center/styles GET]", error.message);
    return NextResponse.json({ error: "Could not load the styles." }, { status: 500 });
  }
  const statuses = Object.fromEntries((data ?? []).map((r) => [r.style as string, r.status as string]));
  const canManage = !(await brandCenterGate(auth, "edit"));
  return NextResponse.json({ canManage, statuses });
}

export async function PUT(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await brandCenterGate(auth, "edit");
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const style = typeof body?.style === "string" ? body.style : "";
  const status = STATUSES.find((s) => s === body?.status);
  if (!isTemplateId(body?.templateId) || !STYLE_RE.test(style) || !status) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { error } = await supabaseServer.from("brand_template_styles").upsert({
    tenant_id: auth.tenant_id, template_id: body!.templateId, style, status, updated_by: auth.account_id, updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,template_id,style" });
  if (error) {
    console.error("[api/brand-center/styles PUT]", error.message);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
