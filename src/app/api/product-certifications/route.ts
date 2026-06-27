import "server-only";

/* ---------------------------------------------------------------------------
   /api/product-certifications  (Phase 4)

   One row per real certificate on product_certifications.
   GET  ?product_id=<uuid>  → { certifications: [...] }
   PUT  { product_id, certifications: [...] }  → replace-the-set (PD/SA only).
   Tenant-scoped via the owning product (table has tenant_id; we also verify
   the product belongs to the caller's tenant before read/write).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, requireProductDataAction } from "@/lib/server/product-access";
import { humanizeError } from "@/lib/ui/humanize-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS =
  "id, product_id, cert_type, certified_standard, cert_number, issuer, issued_date, expiry_date, reminder_days, country_scope, model_ids, file_url, verification_url, status, notes";

async function tenantOwnsProduct(productId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("products").select("id").eq("tenant_id", tenantId).eq("id", productId).maybeSingle();
  return !!data;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const dateOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const uuidArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && UUID_RE.test(x)) : [];

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const productId = new URL(req.url).searchParams.get("product_id") || "";
  if (!UUID_RE.test(productId) || !(await tenantOwnsProduct(productId, auth.tenant_id))) {
    return NextResponse.json({ certifications: [] });
  }
  const { data, error } = await supabaseServer
    .from("product_certifications").select(COLS)
    .eq("product_id", productId).order("expiry_date", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("[api/product-certifications GET]", error.message);
    return NextResponse.json({ error: "Failed to load certifications" }, { status: 500 });
  }
  return NextResponse.json({ certifications: data ?? [] });
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "edit");
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { product_id?: string; certifications?: Array<Record<string, unknown>> };
  const productId = body.product_id || "";
  if (!UUID_RE.test(productId)) return NextResponse.json({ error: "A valid product_id is required." }, { status: 400 });
  if (!(await tenantOwnsProduct(productId, auth.tenant_id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = (Array.isArray(body.certifications) ? body.certifications : [])
    .filter((r) => typeof r.cert_type === "string" && (r.cert_type as string).trim())
    .map((r) => ({
      tenant_id: auth.tenant_id,
      product_id: productId,
      cert_type: (r.cert_type as string).trim(),
      certified_standard: (r.certified_standard as string) || null,
      cert_number: (r.cert_number as string) || null,
      issuer: (r.issuer as string) || null,
      issued_date: dateOrNull(r.issued_date),
      expiry_date: dateOrNull(r.expiry_date),
      reminder_days: num(r.reminder_days),
      country_scope: (r.country_scope as string) || null,
      model_ids: uuidArr(r.model_ids),
      file_url: (r.file_url as string) || null,
      verification_url: (r.verification_url as string) || null,
      status: (r.status as string) || "active",
      notes: (r.notes as string) || null,
    }));

  const del = await supabaseServer.from("product_certifications").delete().eq("product_id", productId);
  if (del.error) return NextResponse.json({ error: humanizeError(del.error) }, { status: 500 });
  if (rows.length) {
    const ins = await supabaseServer.from("product_certifications").insert(rows);
    if (ins.error) return NextResponse.json({ error: humanizeError(ins.error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
