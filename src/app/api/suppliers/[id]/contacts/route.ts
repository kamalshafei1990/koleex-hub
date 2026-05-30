import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/suppliers/[id]/contacts — add a supplier contact person.

   Creates a communication-intelligence entity under the supplier (contacts
   row). Whitelisted, tenant-scoped, Suppliers-module gated. Blocked while
   the caller is viewing-as another user.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import {
  buildContactPatch,
  validateContactPatch,
} from "@/lib/suppliers/contact-fields";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  const { id } = await ctx.params;
  const tid = auth.tenant_id;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const row = buildContactPatch(body);
  const verr = validateContactPatch(row);
  if (verr) return NextResponse.json({ error: verr }, { status: 400 });
  if (!row.full_name || String(row.full_name).trim() === "") {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  // Verify the supplier belongs to this tenant.
  const { data: sup } = await supabaseServer
    .from("contacts")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", tid)
    .eq("contact_type", "supplier")
    .maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const { data, error } = await supabaseServer
    .from("supplier_contact_persons")
    .insert({
      tenant_id: tid,
      supplier_id: id,
      ...row,
      is_active: true,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSupplierEvent({
    tenant_id: tid, supplier_id: id,
    event_type: "contact_added", event_category: "communication",
    title: `Contact added: ${String(row.full_name)}`,
    description: [row.position, row.role_category].filter(Boolean).map(String).join(" · ") || null,
    actor_id: auth.account_id ?? null, actor_name: actorName(auth),
    source_module: "suppliers",
    visibility_tier: typeof row.visibility_tier === "string" ? row.visibility_tier : "internal",
    related_entity_id: data?.id ?? null, related_entity_type: "supplier_contact_persons",
  });

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
