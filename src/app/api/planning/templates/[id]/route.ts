import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { checkPlanningRefs, PLANNING_ERR } from "@/lib/server/planning-access";
import { isPlanningUuid } from "@/lib/planning-validate";
import { normalizeTemplate, parseTemplateInput, writeTemplate } from "@/lib/server/planning-templates";

/* PATCH  /api/planning/templates/:id — update (tenant-scoped)
   DELETE /api/planning/templates/:id — delete (items made from it keep their times) */

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "edit");
  if (deny) return deny;
  const { id } = await params;
  if (!isPlanningUuid(id)) return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });

  const parsed = parseTemplateInput(await req.json().catch(() => null), "patch");
  if (!parsed.ok) return NextResponse.json({ error: PLANNING_ERR[400], field: parsed.field }, { status: 400 });
  const v = parsed.value;
  if (Object.keys(v).length === 0) return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });
  const badRef = await checkPlanningRefs(auth.tenant_id, { resource_id: v.resource_id, role_id: v.role_id });
  if (badRef) return NextResponse.json({ error: badRef === "resource_id" ? "invalid_resource" : "invalid_role", field: badRef }, { status: 400 });

  const { data, error } = await writeTemplate({ kind: "update", id, tenantId: auth.tenant_id, row: { ...v } });
  if (error) {
    console.error("[api/planning/templates PATCH]", error.message);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: PLANNING_ERR[404] }, { status: 404 });
  return NextResponse.json({ template: normalizeTemplate(data) });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "delete");
  if (deny) return deny;
  const { id } = await params;
  if (!isPlanningUuid(id)) return NextResponse.json({ error: PLANNING_ERR[400] }, { status: 400 });

  const { error } = await supabaseServer.from("planning_templates").delete().eq("id", id).eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/planning/templates DELETE]", error.message);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
