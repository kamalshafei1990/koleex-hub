import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { checkPlanningRefs, PLANNING_ERR } from "@/lib/server/planning-access";
import { normalizeTemplate, parseTemplateInput, writeTemplate } from "@/lib/server/planning-templates";

/* GET  /api/planning/templates — the tenant's shift templates
   POST /api/planning/templates — create one
   Body: { name, type?, start_time "HH:MM", end_time "HH:MM", role_id?,
           resource_id?, color? "#rrggbb", default_note? } */

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Planning");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("planning_templates")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .order("name", { ascending: true })
    .limit(500);
  if (error) {
    console.error("[api/planning/templates GET]", error.message);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
  return NextResponse.json(
    { templates: (data ?? []).map((r) => normalizeTemplate(r as Record<string, unknown>)) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Planning", "create");
  if (deny) return deny;

  const parsed = parseTemplateInput(await req.json().catch(() => null), "create");
  if (!parsed.ok) return NextResponse.json({ error: PLANNING_ERR[400], field: parsed.field }, { status: 400 });
  const v = parsed.value;
  const badRef = await checkPlanningRefs(auth.tenant_id, { resource_id: v.resource_id, role_id: v.role_id });
  if (badRef) return NextResponse.json({ error: badRef === "resource_id" ? "invalid_resource" : "invalid_role", field: badRef }, { status: 400 });

  const { data, error } = await writeTemplate({
    kind: "insert",
    row: {
      tenant_id: auth.tenant_id,
      name: v.name,
      type: v.type ?? "shift",
      role_id: v.role_id ?? null,
      start_time: v.start_time,
      duration_hours: v.duration_hours,
      default_note: v.default_note ?? null,
      resource_id: v.resource_id ?? null,
      color: v.color ?? null,
      created_by_account_id: auth.account_id,
    },
  });
  if (error || !data) {
    console.error("[api/planning/templates POST]", error?.message);
    return NextResponse.json({ error: PLANNING_ERR[500] }, { status: 500 });
  }
  return NextResponse.json({ template: normalizeTemplate(data) });
}
