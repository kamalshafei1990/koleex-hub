import "server-only";

/* ---------------------------------------------------------------------------
   /api/suppliers/[id]/classifications — manage a supplier's classification
   tags (supplier_classifications). Tenant-scoped, Suppliers-module gated.

   POST   { classification, is_primary? }  — add (idempotent upsert)
   DELETE ?classification=<value>          — remove one
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { CLASSIFICATION_LABELS, classificationLabel } from "@/lib/suppliers/intelligence";
import { logSupplierEvent, actorName } from "@/lib/suppliers/timeline";

const VALID = new Set(Object.keys(CLASSIFICATION_LABELS));

async function guard(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return { error: auth as NextResponse };
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return { error: deny };
  const { id } = await ctx.params;
  return { auth, id };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, ctx);
  if ("error" in g) return g.error;
  const { auth, id } = g;

  let body: { classification?: string; is_primary?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const classification = String(body.classification ?? "");
  if (!VALID.has(classification)) {
    return NextResponse.json({ error: "Invalid classification" }, { status: 400 });
  }

  // Verify the supplier belongs to this tenant.
  const { data: sup } = await supabaseServer
    .from("contacts")
    .select("id")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .eq("contact_type", "supplier")
    .maybeSingle();
  if (!sup) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  if (body.is_primary) {
    // Only one primary per supplier.
    await supabaseServer
      .from("supplier_classifications")
      .update({ is_primary: false })
      .eq("tenant_id", auth.tenant_id)
      .eq("supplier_id", id);
  }

  const { error } = await supabaseServer
    .from("supplier_classifications")
    .upsert(
      {
        tenant_id: auth.tenant_id,
        supplier_id: id,
        classification,
        is_primary: !!body.is_primary,
        created_by: auth.account_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,supplier_id,classification" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mirror primary classification into contacts.supplier_type (back-compat).
  if (body.is_primary) {
    await supabaseServer
      .from("contacts")
      .update({ supplier_type: classification })
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id);
  }

  await logSupplierEvent({
    tenant_id: auth.tenant_id, supplier_id: id,
    event_type: "classification_added", event_category: "relationship",
    title: `Classification added: ${classificationLabel(classification)}`,
    actor_id: auth.account_id ?? null, actor_name: actorName(auth),
    source_module: "suppliers", visibility_tier: "internal",
    metadata: { classification, is_primary: !!body.is_primary },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, ctx);
  if ("error" in g) return g.error;
  const { auth, id } = g;

  const classification = new URL(req.url).searchParams.get("classification") ?? "";
  if (!VALID.has(classification)) {
    return NextResponse.json({ error: "Invalid classification" }, { status: 400 });
  }
  const { error } = await supabaseServer
    .from("supplier_classifications")
    .delete()
    .eq("tenant_id", auth.tenant_id)
    .eq("supplier_id", id)
    .eq("classification", classification);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logSupplierEvent({
    tenant_id: auth.tenant_id, supplier_id: id,
    event_type: "classification_removed", event_category: "relationship",
    title: `Classification removed: ${classificationLabel(classification)}`,
    actor_id: auth.account_id ?? null, actor_name: actorName(auth),
    source_module: "suppliers", visibility_tier: "internal",
    importance: "low", metadata: { classification },
  });

  return NextResponse.json({ ok: true });
}
