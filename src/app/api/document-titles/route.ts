import "server-only";

/* ---------------------------------------------------------------------------
   /api/document-titles — the heading a commercial document prints under.

   GET     — list (system seeds ∪ tenant customs), 60 s private cache.
   POST    — create a tenant title (super-admin only).
   PATCH   — edit a tenant title (super-admin only; system rows are immutable).
   DELETE  — soft delete (super-admin only).

   Same shape and conventions as /api/incoterms and /api/payment-terms so the
   three settings surfaces feel identical to operate.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

/* Columns a caller may write. Everything else (id, tenant_id, is_system,
   created_by/at) is server-controlled and never accepted from the body. */
const EDITABLE = [
  "code", "label_en", "label_zh", "label_ar",
  "doc_family", "sort_order", "notes", "is_default", "is_active",
] as const;

function pick(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) out[k] = body[k];
  return out;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from("document_titles")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${auth.tenant_id}`)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { rows: data ?? [], tenant_id: auth.tenant_id },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=600" } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super-admin only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.code || !body.label_en) {
    return NextResponse.json({ error: "code and label_en are required." }, { status: 400 });
  }

  /* Only one default per family, so promoting one demotes the rest —
     scoped to this tenant's own rows; system defaults are untouched. */
  if (body.is_default === true) {
    await supabaseServer
      .from("document_titles")
      .update({ is_default: false })
      .eq("tenant_id", auth.tenant_id)
      .eq("doc_family", String(body.doc_family ?? "quotation"));
  }

  const { data, error } = await supabaseServer
    .from("document_titles")
    .insert({
      ...pick(body),
      tenant_id: auth.tenant_id,
      is_system: false,
      created_by: auth.account_id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super-admin only." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  /* System rows ship with the product and are shared by every tenant —
     editing one here would change it for everybody. */
  const { data: existing } = await supabaseServer
    .from("document_titles")
    .select("id, is_system, tenant_id, doc_family")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.is_system) {
    return NextResponse.json({ error: "System titles cannot be edited." }, { status: 403 });
  }
  if (existing.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (body?.is_default === true) {
    await supabaseServer
      .from("document_titles")
      .update({ is_default: false })
      .eq("tenant_id", auth.tenant_id)
      .eq("doc_family", String(body.doc_family ?? existing.doc_family))
      .neq("id", id);
  }

  const { data, error } = await supabaseServer
    .from("document_titles")
    .update({ ...pick(body ?? {}), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ row: data });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json({ error: "Super-admin only." }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const { data: existing } = await supabaseServer
    .from("document_titles")
    .select("id, is_system, tenant_id")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (existing.is_system) {
    return NextResponse.json({ error: "System titles cannot be deleted." }, { status: 403 });
  }
  if (existing.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  /* Soft delete: documents already issued under this title keep rendering,
     because the heading text is copied onto the document when it is chosen. */
  const { error } = await supabaseServer
    .from("document_titles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
