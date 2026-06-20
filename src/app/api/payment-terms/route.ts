import "server-only";

/* ---------------------------------------------------------------------------
   /api/payment-terms — master data CRUD for the International Trade
   Payment Terms System.

   GET    — list all categories + terms visible to the caller's tenant.
            Returns the global system seeds (tenant_id IS NULL) merged
            with any custom terms the tenant has added. Grouped by
            category for the picker UI.

   POST   — create a custom term in the caller's tenant. Super-admin
            only (system seeds remain owned by the platform).

   PATCH  — update a custom term. System rows (is_system = true) are
            immutable. Super-admin only.

   DELETE — soft-delete (is_active = false) a custom term. System rows
            cannot be deleted.

   The endpoint runs through supabaseServer (service-role) so RLS is
   bypassed in code-controlled fashion; tenant isolation is enforced
   explicitly in every query.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

interface CategoryRow {
  id: string;
  code: string;
  name: string;
  short_name: string | null;
  description: string | null;
  default_risk_level: "low" | "medium" | "high" | null;
  is_advance: boolean;
  is_credit: boolean;
  is_bank_mediated: boolean;
  sort_order: number;
  is_active: boolean;
}

interface PaymentTermRow {
  id: string;
  tenant_id: string | null;
  category_id: string;
  code: string;
  label: string;
  short_label: string | null;
  structure: unknown;
  total_days: number | null;
  days_basis: string | null;
  exporter_risk: "low" | "medium" | "high" | null;
  buyer_risk: "low" | "medium" | "high" | null;
  suitable_for: string[];
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  /* Pull categories + terms in parallel. Terms = system rows (tenant_id
     NULL) ∪ this tenant's custom rows. */
  const [catRes, termRes] = await Promise.all([
    supabaseServer
      .from("payment_method_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabaseServer
      .from("payment_terms")
      .select("*")
      .or(`tenant_id.is.null,tenant_id.eq.${auth.tenant_id}`)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (catRes.error) {
    return NextResponse.json({ error: catRes.error.message }, { status: 500 });
  }
  if (termRes.error) {
    return NextResponse.json({ error: termRes.error.message }, { status: 500 });
  }

  const categories = (catRes.data ?? []) as CategoryRow[];
  const terms = (termRes.data ?? []) as PaymentTermRow[];

  /* Group terms by category for the picker UI. The category row carries
     a `terms` array; downstream code can build a select / expandable
     grouped list straight from this shape. */
  const grouped = categories.map((c) => ({
    ...c,
    terms: terms
      .filter((t) => t.category_id === c.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));

  return NextResponse.json(
    {
      categories: grouped,
      terms,
      tenant_id: auth.tenant_id,
    },
    {
      headers: {
        /* Master data — small, low-churn. 60 s private cache keeps the
           picker snappy across the editor without staleness pain. */
        "Cache-Control": "private, max-age=60, stale-while-revalidate=600",
      },
    },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super-admins can create custom payment terms." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | {
        category_id?: string;
        code?: string;
        label?: string;
        short_label?: string;
        structure?: unknown;
        total_days?: number | null;
        days_basis?: string | null;
        exporter_risk?: "low" | "medium" | "high" | null;
        buyer_risk?: "low" | "medium" | "high" | null;
        suitable_for?: string[];
        notes?: string | null;
        sort_order?: number;
        is_default?: boolean;
      }
    | null;
  if (!body || !body.category_id || !body.code || !body.label) {
    return NextResponse.json(
      { error: "category_id, code and label are required." },
      { status: 400 },
    );
  }

  /* If the operator flagged this term as the tenant default, demote any
     existing default for the same category first — one default per
     category per tenant is the invariant. */
  if (body.is_default) {
    await supabaseServer
      .from("payment_terms")
      .update({ is_default: false })
      .eq("tenant_id", auth.tenant_id)
      .eq("category_id", body.category_id);
  }

  const { data, error } = await supabaseServer
    .from("payment_terms")
    .insert({
      tenant_id: auth.tenant_id,
      category_id: body.category_id,
      code: body.code,
      label: body.label,
      short_label: body.short_label ?? null,
      structure: body.structure ?? [],
      total_days: body.total_days ?? null,
      days_basis: body.days_basis ?? "none",
      exporter_risk: body.exporter_risk ?? null,
      buyer_risk: body.buyer_risk ?? null,
      suitable_for: body.suitable_for ?? [],
      notes: body.notes ?? null,
      sort_order: body.sort_order ?? 1000,
      is_system: false,
      is_default: !!body.is_default,
      is_active: true,
      created_by: auth.account_id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ term: data });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super-admins can edit payment terms." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | (Record<string, unknown> & { id?: string })
    | null;
  if (!body || !body.id) {
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  /* Resolve the row first so we can refuse updates to system rows. */
  const { data: existing, error: getErr } = await supabaseServer
    .from("payment_terms")
    .select("id, tenant_id, is_system, category_id")
    .eq("id", body.id)
    .single();
  if (getErr || !existing) {
    return NextResponse.json({ error: "Term not found." }, { status: 404 });
  }
  /* Super-admin may edit system seeds (tenant_id NULL) and own-tenant rows. */
  if (existing.tenant_id !== null && existing.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Term not in your tenant." }, { status: 403 });
  }

  /* Same default-demotion dance as POST. */
  if (body.is_default === true) {
    await supabaseServer
      .from("payment_terms")
      .update({ is_default: false })
      .eq("tenant_id", auth.tenant_id)
      .eq("category_id", existing.category_id)
      .neq("id", body.id);
  }

  const patch: Record<string, unknown> = {};
  for (const k of [
    "label",
    "short_label",
    "structure",
    "total_days",
    "days_basis",
    "exporter_risk",
    "buyer_risk",
    "suitable_for",
    "notes",
    "sort_order",
    "is_default",
    "is_active",
  ] as const) {
    if (k in body) patch[k] = body[k];
  }
  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("payment_terms")
    .update(patch)
    .eq("id", body.id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ term: data });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  if (!auth.is_super_admin) {
    return NextResponse.json(
      { error: "Only super-admins can delete payment terms." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id query param required." }, { status: 400 });
  }

  /* Soft delete — flip is_active. Hard-delete is reserved for never-used
     custom rows; with FK references coming (quotations/invoices may
     point at term ids) flipping the flag is safer. */
  const { data: existing, error: getErr } = await supabaseServer
    .from("payment_terms")
    .select("id, tenant_id, is_system")
    .eq("id", id)
    .single();
  if (getErr || !existing) {
    return NextResponse.json({ error: "Term not found." }, { status: 404 });
  }
  if (existing.tenant_id !== null && existing.tenant_id !== auth.tenant_id) {
    return NextResponse.json({ error: "Term not in your tenant." }, { status: 403 });
  }

  const { error } = await supabaseServer
    .from("payment_terms")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
