import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess , requireModuleAction} from "@/lib/server/auth";

/* GET-by-id for a single doc-builder invoice. Mirrors the
   /api/quotations/[id] handler so the front-end's `fetchDocOne`
   helper (which builds `${listPath}/${id}` = "/api/invoices/doc/<id>")
   has a real route to hit. Returns the row plus the embedded
   customer info -- same shape the list endpoint produces, just
   for a single row. */
type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("invoices")
    /* The `customers` table has `name` (NOT display_name) and singular
       email / phone / address columns. We alias `name AS display_name`
       so every downstream consumer (InvoicesApp, ProjectsApp, etc.)
       that reads `customer.display_name` keeps working without
       changes. The plural emails/phones/addresses fields don't exist
       on customers -- they live on the `people` table -- so we drop
       them here. */
    .select(`*, customer:customer_id ( id, display_name:name, company_name )`)
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    console.error("[api/invoices/doc/[id] GET]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ invoice: data });
}

/* DELETE a doc-builder invoice. The front-end's `deleteDoc` helper issues
   DELETE `${listPath}/${id}` = "/api/invoices/doc/<id>" — without this
   handler Next.js answered 405, so the row reappeared on the next list
   read and deletes silently failed. Child rows (invoice_items,
   invoice_payments) are ON DELETE CASCADE, so they go with the parent. */
export async function DELETE(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Invoices", "delete");
  if (deny) return deny;
  const { id } = await params;

  const { error } = await supabaseServer
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id);
  if (error) {
    console.error("[api/invoices/doc/[id] DELETE]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
