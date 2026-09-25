import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/work-reports/links/search?type=customer|supplier|product|order&q=
   What a report's links block can point at (Phase 4A) — at most 15, the
   newest first when nothing is typed. Each kind is gated by the app that
   owns it (Customers, Suppliers, Orders; products as the catalogue shows
   them: active only), so a link never shows a name its author could not
   already see; without that app the answer is { hits: [], denied: true }.
   The typed text is stripped of the characters PostgREST filters use.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { requireReportsUser } from "@/lib/server/reports/core";
import { REPORT_LINK_TYPES, type ReportLinkType } from "@/lib/reports/templates";

export const dynamic = "force-dynamic";

const MODULE: Partial<Record<ReportLinkType, string>> = { customer: "Customers", supplier: "Suppliers", order: "Orders" };
const LIMIT = 15;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const deny = requireReportsUser(auth);
  if (deny) return deny;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ReportLinkType | null;
  if (!type || !REPORT_LINK_TYPES.includes(type)) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const mod = MODULE[type];
  if (mod && (await requireModuleAccess(auth, mod))) return NextResponse.json({ hits: [], denied: true }, { headers: { "Cache-Control": "private, no-store" } });
  const q = (url.searchParams.get("q") ?? "").replace(/[,()%*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const like = `%${q}%`;

  let hits: Array<{ id: string; label: string; sub?: string }> = [];
  if (type === "customer" || type === "supplier") {
    let s = supabaseServer.from("contacts").select("id, display_name, company_name, full_name, country").eq("contact_type", type);
    if (auth.tenant_id) s = s.eq("tenant_id", auth.tenant_id);
    if (q) s = s.or(`display_name.ilike.${like},company_name.ilike.${like},full_name.ilike.${like}`);
    const { data, error } = await (q ? s.order("display_name", { ascending: true }) : s.order("updated_at", { ascending: false })).limit(LIMIT);
    if (error) return failed(error.message);
    hits = ((data ?? []) as Array<{ id: string; display_name: string | null; company_name: string | null; full_name: string | null; country: string | null }>).map((c) => {
      const label = c.display_name || c.company_name || c.full_name || "—";
      return { id: c.id, label, sub: [c.company_name && c.company_name !== label ? c.company_name : null, c.country].filter(Boolean).join(" · ") || undefined };
    });
  } else if (type === "product") {
    let s = supabaseServer.from("products").select("id, product_name, brand").eq("status", "active");
    if (auth.tenant_id) s = s.eq("tenant_id", auth.tenant_id);
    if (q) s = s.ilike("search_text", like.toLowerCase());
    const { data, error } = await (q ? s.order("product_name", { ascending: true }) : s.order("updated_at", { ascending: false })).limit(LIMIT);
    if (error) return failed(error.message);
    hits = ((data ?? []) as Array<{ id: string; product_name: string | null; brand: string | null }>).map((p) => ({ id: p.id, label: p.product_name || "—", sub: p.brand || undefined }));
  } else {
    let s = supabaseServer.from("orders").select("id, order_no, deal_no, customer_name, company_name, customer_code");
    if (auth.tenant_id) s = s.eq("tenant_id", auth.tenant_id);
    if (q) s = s.or(`order_no.ilike.${like},customer_name.ilike.${like},company_name.ilike.${like},customer_code.ilike.${like}`);
    const { data, error } = await s.order("created_at", { ascending: false }).limit(LIMIT);
    if (error) return failed(error.message);
    hits = ((data ?? []) as Array<{ id: string; order_no: string | null; deal_no: number | string | null; customer_name: string | null; company_name: string | null; customer_code: string | null }>).map((o) => ({
      id: o.id, label: o.order_no || (o.deal_no != null ? `#${o.deal_no}` : "—"), sub: o.company_name || o.customer_name || o.customer_code || undefined,
    }));
  }
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "private, no-store" } });
}

function failed(message: string) {
  console.error("[api/work-reports/links/search]", message);
  return NextResponse.json({ error: "Could not search." }, { status: 500 });
}
