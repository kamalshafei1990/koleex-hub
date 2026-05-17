import "server-only";

/* GET /api/reports/operational?kind=sales|purchases|expenses|inventory|customers|suppliers
 *  &from=YYYY-MM-DD&to=YYYY-MM-DD */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getUserExperience } from "@/lib/experience";
import {
  buildSalesReport, buildPurchasesReport, buildExpensesReport,
  buildInventoryReport, buildCustomersReport, buildSuppliersReport,
} from "@/lib/reports/operational";

const RESTRICTED = new Set(["purchases", "expenses", "inventory"]);   // require cost-data visibility

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "sales";
  const year = new Date().getUTCFullYear();
  const from = url.searchParams.get("from") ?? `${year}-01-01`;
  const to   = url.searchParams.get("to")   ?? new Date().toISOString().slice(0, 10);

  const exp = await getUserExperience(auth);
  if (RESTRICTED.has(kind) && !exp.can_see_cost_data) {
    return NextResponse.json({ error: "Insufficient permission for cost data." }, { status: 403 });
  }

  try {
    let report;
    switch (kind) {
      case "sales":     report = await buildSalesReport(auth.tenant_id, { from, to }); break;
      case "purchases": report = await buildPurchasesReport(auth.tenant_id, { from, to }); break;
      case "expenses":  report = await buildExpensesReport(auth.tenant_id, { from, to }); break;
      case "inventory": report = await buildInventoryReport(auth.tenant_id); break;
      case "customers": report = await buildCustomersReport(auth.tenant_id); break;
      case "suppliers": report = await buildSuppliersReport(auth.tenant_id); break;
      default: return NextResponse.json({ error: "Unknown report kind." }, { status: 400 });
    }
    return NextResponse.json({ report, from, to, kind });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
