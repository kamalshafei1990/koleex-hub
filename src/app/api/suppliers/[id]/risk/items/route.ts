import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/suppliers/[id]/risk/items — raise a supplier risk item.

   Per-item visibility (a payment dispute → finance, leverage exposure →
   management, operational delay → procurement). Emits a visibility-aware
   timeline event (risk_raised, or dispute_opened for financial disputes).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";
import { riskDimensionLabel } from "@/lib/suppliers/intelligence";

const DIMS = new Set(["financial", "operational", "strategic", "geographic", "relationship"]);
const SEV = new Set(["low", "medium", "high", "critical"]);
const STATUS = new Set(["open", "mitigating", "resolved"]);
const VIS = new Set(["public", "internal", "procurement", "finance", "management"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Suppliers", "create");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  const dimension = typeof body.dimension === "string" ? body.dimension : "";
  if (!DIMS.has(dimension)) return NextResponse.json({ error: "Invalid dimension" }, { status: 400 });
  const severity = typeof body.severity === "string" && SEV.has(body.severity) ? body.severity : "medium";
  const status = typeof body.status === "string" && STATUS.has(body.status) ? body.status : "open";
  const visibility = typeof body.visibility_tier === "string" && VIS.has(body.visibility_tier) ? body.visibility_tier : "procurement";

  const { data: sup } = await supabaseServer
    .from("contacts").select("id").eq("id", id).eq("tenant_id", tid).eq("contact_type", "supplier").maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { data, error } = await supabaseServer
    .from("supplier_risk_items")
    .insert({
      tenant_id: tid, supplier_id: id,
      dimension, severity, status, title,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      mitigation: typeof body.mitigation === "string" && body.mitigation.trim() ? body.mitigation.trim() : null,
      visibility_tier: visibility,
      raised_by: auth.account_id ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const isDispute = dimension === "financial" && /dispute|chargeback|non[- ]?payment|overdue/i.test(title);
  await logSupplierEvent({
    tenant_id: tid, supplier_id: id,
    event_type: isDispute ? "dispute_opened" : "risk_raised",
    event_category: "procurement",
    title: `${isDispute ? "Dispute opened" : "Risk raised"} · ${riskDimensionLabel(dimension)}: ${title}`,
    actor_id: auth.account_id ?? null, actor_name: actorName(auth),
    source_module: "suppliers", visibility_tier: visibility,
    importance: severity === "critical" ? "critical" : severity === "high" ? "high" : "normal",
    related_entity_id: data?.id ?? null, related_entity_type: "supplier_risk_items",
    metadata: { dimension, severity },
  });

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
