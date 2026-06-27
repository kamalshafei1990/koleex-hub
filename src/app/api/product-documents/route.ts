import "server-only";

/* ---------------------------------------------------------------------------
   /api/product-documents  (Phase 4)

   Structured industrial documents on product_documents (12 doc types).
   GET  ?product_id=<uuid>  → { documents: [...] }
   PUT  { product_id, documents: [...] }  → replace-the-set (PD/SA only).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";
import { hasProductDataAccess, requireProductDataAction } from "@/lib/server/product-access";
import { humanizeError } from "@/lib/ui/humanize-error";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLS =
  "id, product_id, doc_type, title, file_url, file_name, file_size_kb, language, version, model_ids, sort_order";

const DOC_TYPES = new Set([
  "user_manual", "spare_parts_list", "exploded_view", "wiring_diagram",
  "installation_guide", "brochure", "catalog", "certificate", "test_report",
  "packing_list", "dimension_drawing", "cad_3d",
]);

async function tenantOwnsProduct(productId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("products").select("id").eq("tenant_id", tenantId).eq("id", productId).maybeSingle();
  return !!data;
}
const uuidArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && UUID_RE.test(x)) : [];

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const productId = new URL(req.url).searchParams.get("product_id") || "";
  if (!UUID_RE.test(productId) || !(await tenantOwnsProduct(productId, auth.tenant_id))) {
    return NextResponse.json({ documents: [] });
  }
  const { data, error } = await supabaseServer
    .from("product_documents").select(COLS)
    .eq("product_id", productId).order("sort_order", { ascending: true });
  if (error) {
    console.error("[api/product-documents GET]", error.message);
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 });
  }
  return NextResponse.json({ documents: data ?? [] });
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const denied = await requireProductDataAction(auth, "edit");
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { product_id?: string; documents?: Array<Record<string, unknown>> };
  const productId = body.product_id || "";
  if (!UUID_RE.test(productId)) return NextResponse.json({ error: "A valid product_id is required." }, { status: 400 });
  if (!(await tenantOwnsProduct(productId, auth.tenant_id))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = (Array.isArray(body.documents) ? body.documents : [])
    /* doc_type must be known + file_url present — a document with no file
       is meaningless, so we drop empty rows rather than persist blanks. */
    .filter((r) => DOC_TYPES.has(r.doc_type as string) && typeof r.file_url === "string" && (r.file_url as string).trim())
    .map((r, i) => ({
      tenant_id: auth.tenant_id,
      product_id: productId,
      doc_type: r.doc_type as string,
      title: (r.title as string) || null,
      file_url: (r.file_url as string).trim(),
      file_name: (r.file_name as string) || null,
      file_size_kb: typeof r.file_size_kb === "number" ? r.file_size_kb : null,
      language: (r.language as string) || null,
      version: (r.version as string) || null,
      model_ids: uuidArr(r.model_ids),
      sort_order: i,
    }));

  const del = await supabaseServer.from("product_documents").delete().eq("product_id", productId);
  if (del.error) return NextResponse.json({ error: humanizeError(del.error) }, { status: 500 });
  if (rows.length) {
    const ins = await supabaseServer.from("product_documents").insert(rows);
    if (ins.error) return NextResponse.json({ error: humanizeError(ins.error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: rows.length });
}
