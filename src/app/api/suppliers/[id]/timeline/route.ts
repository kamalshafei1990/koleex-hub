import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/suppliers/[id]/timeline — log a manual operational event.

   Meetings, supplier/factory visits, calls, negotiation notes, issues,
   milestones. Whitelisted, tenant + supplier scoped, Suppliers-module gated,
   blocked while viewing-as. Category is derived from the chosen event type.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";
import { MANUAL_EVENT_TYPES } from "@/lib/suppliers/intelligence";

const VISIBILITY = new Set(["public", "internal", "procurement", "finance", "management"]);
const IMPORTANCE = new Set(["low", "normal", "high", "critical"]);
const TYPE_MAP = new Map(MANUAL_EVENT_TYPES.map((t) => [t.type, t.category]));

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Suppliers", "create");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const eventType = typeof body.event_type === "string" ? body.event_type : "";
  const category = TYPE_MAP.get(eventType);
  if (!category) return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });

  const visibility = typeof body.visibility_tier === "string" && VISIBILITY.has(body.visibility_tier)
    ? body.visibility_tier : "internal";
  const importance = typeof body.importance === "string" && IMPORTANCE.has(body.importance)
    ? (body.importance as "low" | "normal" | "high" | "critical") : "normal";

  // Verify the supplier belongs to this tenant.
  const { data: sup } = await supabaseServer
    .from("contacts")
    .select("id").eq("id", id).eq("tenant_id", tid).eq("contact_type", "supplier").maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { data, error } = await supabaseServer
    .from("supplier_timeline_events")
    .insert({
      tenant_id: tid,
      supplier_id: id,
      event_type: eventType,
      event_category: category,
      title,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      actor_id: auth.account_id ?? null,
      actor_name: actorName(auth),
      source_module: "manual",
      visibility_tier: visibility,
      importance,
      is_manual: true,
      metadata: body.event_date && typeof body.event_date === "string" ? { event_date: body.event_date } : {},
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
