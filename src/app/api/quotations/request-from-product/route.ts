import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/quotations/request-from-product

   The customer-facing "Request Quote" button on /products/[id] posts
   to this endpoint. It creates a draft quotation pre-filled with the
   chosen product + quantity + optional message, assigned to the
   caller's contact when they're signed in as a customer user.

   Body:
     {
       product_id: string (uuid),
       qty?: number,           // default 1
       model_id?: string,      // optional — pin to a specific model
       notes?: string,         // customer's message / custom requirements
     }

   Response:
     { quote_id, quote_no }

   Notes:
     - Available to any authenticated user in the tenant. Internal
       users (sales / admin) can use the same button to start a fresh
       draft tied to a walk-in lead — customer_id stays null in that
       case because there's no contact to attach.
     - Status is always "draft" so it shows up in the admin Quotations
       list for sales to review + finalise.
     - No price calculation here — the internal team fills in prices
       when they convert the draft. The doc.note carries the
       customer's request text so it's visible in the builder.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

async function nextQuoteNumber(tenantId: string): Promise<string> {
  /* Mirrors the minting logic in /api/quotations — KL<year>-NNNN.
     Duplicated rather than imported to keep this route self-contained
     and to avoid a circular edit surface. */
  const year = new Date().getFullYear();
  const prefix = `KL${year}-`;
  const { data } = await supabaseServer
    .from("quotations")
    .select("quote_no")
    .eq("tenant_id", tenantId)
    .ilike("quote_no", `${prefix}%`)
    .order("quote_no", { ascending: false })
    .limit(1);
  const last = data?.[0]?.quote_no as string | undefined;
  const nextSeq = last ? Number(last.replace(prefix, "")) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  let body: { product_id?: string; qty?: number; model_id?: string; notes?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const productId = body.product_id?.trim();
  if (!productId) {
    return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  }
  const qty = Math.max(1, Math.min(9999, Number(body.qty ?? 1) || 1));
  const notes = body.notes?.trim() || null;
  const modelId = body.model_id?.trim() || null;

  /* Resolve who the quote belongs to. The `quotations.customer_id`
     FK targets the pricing-engine `customers` table, NOT the
     `contacts` table — so accounts.contact_id doesn't resolve
     directly. Best-effort match: pull the customer contact's email,
     look it up in `customers` table. If no match, leave null and
     the sales rep links it manually from the builder. */
  let customerId: string | null = null;
  if (auth.user_type === "customer") {
    const { data: acc } = await supabaseServer
      .from("accounts")
      .select("login_email, contact_id")
      .eq("id", auth.account_id)
      .maybeSingle();
    const email = (acc as { login_email?: string } | null)?.login_email;
    if (email) {
      const { data: cust } = await supabaseServer
        .from("customers")
        .select("id")
        .eq("tenant_id", auth.tenant_id)
        .ilike("email", email)
        .maybeSingle();
      customerId = ((cust as { id?: string } | null)?.id) ?? null;
    }
  }

  /* Look up product summary so the draft shows a recognisable name
     in the quote_builder and Quotations list without a follow-up
     round-trip. */
  const { data: product } = await supabaseServer
    .from("products")
    .select("id, product_name, slug")
    .eq("id", productId)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const quoteNo = await nextQuoteNumber(auth.tenant_id);
  const issueDate = new Date().toISOString().slice(0, 10);

  /* doc jsonb mirrors what the builder UI consumes. Keep it minimal
     — the sales rep will fill in prices + terms + discounts when
     they convert the draft. */
  const productRow = product as { id: string; product_name: string; slug: string | null };
  const doc = {
    lines: [
      {
        product_id: productRow.id,
        product_name: productRow.product_name,
        product_slug: productRow.slug,
        model_id: modelId,
        qty,
        unit_price: 0,
        line_discount_percent: 0,
      },
    ],
    customerNote: notes,
    source: "customer-request",
    requestedBy: {
      account_id: auth.account_id,
      user_type: auth.user_type,
      requested_at: new Date().toISOString(),
    },
  };

  const { data: quote, error: quoteErr } = await supabaseServer
    .from("quotations")
    .insert({
      tenant_id: auth.tenant_id,
      quote_no: quoteNo,
      customer_id: customerId,
      currency: "USD",
      status: "draft",
      issue_date: issueDate,
      valid_till: null,
      total: 0,
      doc,
      notes,
      /* quotations.created_by FK targets auth.users(id) (Supabase
         Auth's internal table), not the app's accounts table. This
         hub runs on legacy auth so our account IDs aren't in
         auth.users — passing auth.account_id trips
         quotations_created_by_fkey. The real creator info is safe
         inside doc.requestedBy for audit; created_by stays null at
         the column level. */
      created_by: null,
    })
    .select("id, quote_no")
    .single();

  if (quoteErr || !quote) {
    console.error("[api/quotations/request-from-product]", quoteErr?.message);
    return NextResponse.json(
      { error: quoteErr?.message || "Failed to create quote request" },
      { status: 500 },
    );
  }

  /* Also mirror the line into quotation_items so downstream reports
     that join on that table (pricing, landed cost, etc.) see the
     request. Non-fatal if the insert fails — the doc already holds
     the canonical line data. */
  const quoteRow = quote as { id: string; quote_no: string };
  void supabaseServer.from("quotation_items").insert({
    quotation_id: quoteRow.id,
    product_id: productRow.id,
    qty,
    unit_price: 0,
    line_discount_percent: 0,
  });

  return NextResponse.json({
    ok: true,
    quote_id: quoteRow.id,
    quote_no: quoteRow.quote_no,
  });
}
