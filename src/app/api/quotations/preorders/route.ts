import "server-only";

/* Preorder (price-request) persistence — list + create. Tenant-scoped via the
   service-role client behind requireAuth (RLS is on; access only through here). */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";

/* Trim, and treat blank as absent — the same helper lives in ./[id]/route.ts
   so a value round-trips identically through create and update. */
const str = (v: unknown, n: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;

/* A preorder doc is sections + items + a few data-URL photos. 2 MB is far
   above any real document and well under what the function should ever hold
   in memory for one request; a larger body is refused before it is parsed.
   Not exported (route modules may only export handlers); ./[id]/route.ts
   repeats the value. */
const DOC_MAX_BYTES = 2 * 1024 * 1024;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;

  const { data, error } = await supabaseServer
    .from("quotation_preorders")
    .select("id, title, customer_ar, reference, currency, status, updated_at")
    .eq("tenant_id", auth.tenant_id)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (error) {
    console.error("[api/quotations/preorders GET]", error.message);
    return NextResponse.json({ error: "Couldn't load preorders." }, { status: 500 });
  }
  return NextResponse.json({ preorders: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Quotations", "create");
  if (deny) return deny;

  const raw = await req.text().catch(() => "");
  if (raw.length > DOC_MAX_BYTES) {
    return NextResponse.json({ error: "Preorder is too large to save (limit 2 MB)." }, { status: 413 });
  }
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = null; }
  const doc = body?.doc && typeof body.doc === "object" && !Array.isArray(body.doc) ? body.doc : {};

  const row = {
    tenant_id: auth.tenant_id,
    title: str(body?.title, 200) ?? str(body?.reference, 200) ?? "Preorder",
    customer_ar: str(body?.customer_ar, 200),
    reference: str(body?.reference, 200),
    currency: str(body?.currency, 10) ?? "USD",
    status: "draft",
    doc,
    created_by: auth.account_id,
  };

  const { data, error } = await supabaseServer
    .from("quotation_preorders")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("[api/quotations/preorders POST]", error.message);
    return NextResponse.json({ error: "Couldn't save the preorder." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
