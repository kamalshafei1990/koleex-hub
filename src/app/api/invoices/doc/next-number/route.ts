import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* Returns the *predicted* next invoice number for this tenant so the
   editor can preview "INV2026-0042" on a new-invoice draft instead of
   showing a blank "—" until first save. The actual number is still
   minted server-side on insert (POST /api/invoices/doc) — this endpoint
   only previews it, and a near-simultaneous save by another operator
   could legitimately bump the sequence. Same formula as the one in
   /api/invoices/doc/route.ts so the previewed number matches what the
   server will assign 99% of the time. */
async function previewNextInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV${year}-`;
  const { data } = await supabaseServer
    .from("invoices")
    .select("inv_no")
    .eq("tenant_id", tenantId)
    .ilike("inv_no", `${prefix}%`)
    .order("inv_no", { ascending: false })
    .limit(1);
  const last = data?.[0]?.inv_no as string | undefined;
  const tail = last ? last.replace(prefix, "") : "";
  const parsed = /^\d+$/.test(tail) ? Number(tail) : NaN;
  const nextSeq = Number.isFinite(parsed) ? parsed + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;

  const inv_no = await previewNextInvoiceNumber(auth.tenant_id);
  return NextResponse.json({ inv_no });
}
