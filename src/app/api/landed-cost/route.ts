import "server-only";

/* ---------------------------------------------------------------------------
   GET  /api/landed-cost      — list simulations (newest first).
   POST /api/landed-cost      — create a simulation.

   landed_cost_simulations has RLS enabled with only a service_role policy, so
   ALL access must go through this server client (the anon browser key is
   denied). These handlers are the security boundary: they require an
   authenticated session, then use the service-role client.

   The table is global (no tenant_id column), so no tenant scoping is applied —
   this preserves the app's existing shared-simulations behavior.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth } from "@/lib/server/auth";

const TABLE = "landed_cost_simulations";

/* Columns a client may set. Server owns id + timestamps. */
const WRITABLE = [
  "name", "status",
  "customer_name", "customer_company", "customer_country", "customer_city", "warehouse_destination",
  "product_id", "product_name", "model_id", "model_name", "sku", "hs_code", "brand", "country_of_origin",
  "quantity", "unit_price", "currency", "price_basis",
  "product_info", "export_costs", "shipping", "import_costs", "inland_delivery", "financial", "results",
  "notes",
  // Platform v2 additive columns
  "commercial", "confidence", "responsibility", "currencies", "actuals", "customs_profile",
] as const;

export function pickWritable(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of WRITABLE) if (k in body) out[k] = body[k];
  return out;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await supabaseServer
    .from(TABLE)
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[api/landed-cost GET]", error.message);
    return NextResponse.json({ error: "Failed to load simulations" }, { status: 500 });
  }
  return NextResponse.json({ simulations: data ?? [] }, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=60" },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as Record<string, unknown>;
  const row = pickWritable(body);
  if (typeof row.name !== "string" || !(row.name as string).trim()) {
    row.name = "Untitled Simulation";
  }

  const { data, error } = await supabaseServer
    .from(TABLE)
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("[api/landed-cost POST]", error.message);
    return NextResponse.json({ error: "Failed to create simulation" }, { status: 500 });
  }
  return NextResponse.json({ id: (data as { id: string }).id });
}
