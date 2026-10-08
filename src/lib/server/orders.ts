import "server-only";

/* ---------------------------------------------------------------------------
   The order behind a deal.

   Every document of a deal — quotation, invoice, sales contract, packing list
   — hangs off one order row keyed by the shared deal number. Whichever
   document is raised first creates it; the rest find it.

   This lives in one place because the alternative was each route inserting
   its own order row, and two routes racing on the same deal would then both
   insert, hit the (tenant_id, deal_no) unique index, and fail the user's
   actual work over bookkeeping.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "./supabase-server";

export interface EnsureOrderArgs {
  tenantId: string;
  dealNo: number;
  customerId: string | null;
  currency: string | null;
  total: number;
  accountId: string;
}

/** Create the order for this deal, or return the one that already exists.
    Never fatal: a document without an order is still a valid document and
    can be attached later. Returns null if the order could not be made. */
export async function ensureOrder(args: EnsureOrderArgs): Promise<string | null> {
  const { tenantId, dealNo, customerId, currency, total, accountId } = args;

  const { data: existing } = await supabaseServer
    .from("orders")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("deal_no", dealNo)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  type CustomerSnapshot = {
    customer_code: string | null;
    name: string | null;
    company_name: string | null;
  };
  let snapshot: CustomerSnapshot | null = null;
  if (customerId) {
    const { data } = await supabaseServer
      .from("customers")
      .select("customer_code, name, company_name")
      .eq("id", customerId)
      .maybeSingle();
    snapshot = (data as CustomerSnapshot | null) ?? null;
  }

  const { data, error } = await supabaseServer
    .from("orders")
    .insert({
      tenant_id: tenantId,
      deal_no: dealNo,
      order_no: `KL-${dealNo}`,
      customer_id: customerId,
      customer_code: snapshot?.customer_code ?? null,
      customer_name: snapshot?.name ?? null,
      company_name: snapshot?.company_name ?? null,
      currency,
      total,
      status: "open",
      created_by: accountId,
    })
    .select("id")
    .single();

  if (error) {
    /* A concurrent creator won the race on (tenant_id, deal_no). That is the
       right outcome — take theirs rather than failing the caller. */
    const { data: raced } = await supabaseServer
      .from("orders")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("deal_no", dealNo)
      .maybeSingle();
    if (raced?.id) return raced.id as string;
    console.warn("[orders] could not create order for deal", dealNo, error.message);
    return null;
  }
  return data.id as string;
}
