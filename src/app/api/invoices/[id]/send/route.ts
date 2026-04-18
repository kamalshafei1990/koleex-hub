import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";

/* POST /api/invoices/:id/send — mark a draft invoice as sent and fire
   an inbox notification to the customer's account (if they have one)
   AND to the creator if they're not the sender. */

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Invoices");
  if (deny) return deny;
  const { id } = await params;

  const { data, error } = await supabaseServer
    .from("invoices")
    .update({
      status: "sent",
      issued_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .in("status", ["draft", "sent"])
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Invoice not in a sendable state" }, { status: 400 });

  // Optional: ping the customer's linked account if one exists.
  if (data.customer_id) {
    const { data: custAcct } = await supabaseServer
      .from("accounts")
      .select("id")
      .eq("contact_id", data.customer_id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    if (custAcct?.id) {
      void supabaseServer.from("inbox_messages").insert({
        recipient_account_id: custAcct.id,
        sender_account_id: auth.account_id,
        tenant_id: auth.tenant_id,
        category: "system",
        subject: `Invoice ${data.inv_no} issued`,
        body: `An invoice for ${data.currency} ${Number(data.total).toFixed(2)} has been issued${data.due_date ? ` and is due ${data.due_date}` : ""}.`,
        link: "/invoices",
        metadata: { source: "invoices", invoice_id: data.id, inv_no: data.inv_no },
      });
    }
  }

  return NextResponse.json({ invoice: data });
}
