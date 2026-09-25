import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/work-reports/links/search?type=customer|supplier|product|order|quotation|invoice&q=
   What a report's links block can point at (Phase 4A; quotations and
   invoices 4B) — at most 15, the newest first when nothing is typed. Each
   kind is gated by the app that owns it (Customers, Suppliers, Orders,
   Quotations, Invoices; products as the catalogue shows them: active only),
   so a link never shows a name its author could not already see; without
   that app the answer is { hits: [], denied: true }. A quotation or an
   invoice is found by its number or the customer written on it.
   The typed text is stripped of the characters PostgREST filters use.
   5C: what a report's numbers are about — a project (the Projects app's own
   rule: a super admin all, anyone else the projects they manage, created,
   are a member of or hold a task in; templates left out), an employee (HR ·
   view: everyone still employed; a manager without it: their own team) and
   a warehouse (Inventory; active ones).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { loadOrgTree, requireReportsUser } from "@/lib/server/reports/core";
import { involvedProjectsOr } from "@/lib/server/project-access";
import { REPORT_LINK_TYPES, type ReportLinkType } from "@/lib/reports/templates";

export const dynamic = "force-dynamic";

const MODULE: Partial<Record<ReportLinkType, string>> = { customer: "Customers", supplier: "Suppliers", order: "Orders", quotation: "Quotations", invoice: "Invoices", project: "Projects", warehouse: "Inventory" };
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
  if (type === "project") {
    let s = supabaseServer.from("projects").select("id, name, code, status").eq("is_template", false);
    if (auth.tenant_id) s = s.eq("tenant_id", auth.tenant_id);
    if (!auth.is_super_admin) s = s.or(await involvedProjectsOr(auth.tenant_id ?? "", auth.account_id));
    if (q) s = s.or(`name.ilike.${like},code.ilike.${like}`);
    const { data, error } = await (q ? s.order("name", { ascending: true }) : s.order("updated_at", { ascending: false })).limit(LIMIT);
    if (error) return failed(error.message);
    hits = ((data ?? []) as Array<{ id: string; name: string | null; code: string | null; status: string | null }>).map((p) => ({ id: p.id, label: p.name || p.code || "—", sub: [p.code, p.status].filter(Boolean).join(" · ") || undefined }));
  } else if (type === "warehouse") {
    let s = supabaseServer.from("inventory_warehouses").select("id, name, code, location").eq("is_active", true).is("deleted_at", null);
    if (auth.tenant_id) s = s.eq("tenant_id", auth.tenant_id);
    if (q) s = s.or(`name.ilike.${like},code.ilike.${like}`);
    const { data, error } = await s.order("name", { ascending: true }).limit(LIMIT);
    if (error) return failed(error.message);
    hits = ((data ?? []) as Array<{ id: string; name: string | null; code: string | null; location: string | null }>).map((w) => ({ id: w.id, label: w.name || w.code || "—", sub: [w.code, w.location].filter(Boolean).join(" · ") || undefined }));
  } else if (type === "employee") {
    /* HR · view: everyone still employed; else the writer's own team. */
    const hr = auth.is_super_admin || (await requireModuleAction(auth, "HR", "view")) === null;
    const team = hr ? null : (await loadOrgTree(auth.tenant_id)).descendantsOf(auth.account_id);
    if (team && !team.length) return NextResponse.json({ hits: [], denied: true }, { headers: { "Cache-Control": "private, no-store" } });
    let s = supabaseServer.from("koleex_employees").select("id, account_id, employee_number, position, people(full_name)").in("employment_status", ["active", "on_leave", "probation"]);
    if (auth.tenant_id) s = s.or(`tenant_id.eq.${auth.tenant_id},tenant_id.is.null`);
    if (team) s = s.in("account_id", team.slice(0, 200));
    const { data, error } = await s.limit(300);
    if (error) return failed(error.message);
    type E = { id: string; employee_number: string | null; position: string | null; people?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null };
    const name = (e: E) => (Array.isArray(e.people) ? e.people[0]?.full_name : e.people?.full_name) ?? "";
    const needle = q.toLowerCase();
    hits = ((data ?? []) as E[])
      .map((e) => ({ id: e.id, label: name(e) || e.employee_number || "—", sub: [e.employee_number, e.position].filter(Boolean).join(" · ") || undefined }))
      .filter((h) => !needle || h.label.toLowerCase().includes(needle) || (h.sub ?? "").toLowerCase().includes(needle))
      .sort((a, b) => a.label.localeCompare(b.label)).slice(0, LIMIT);
  } else if (type === "customer" || type === "supplier") {
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
  } else if (type === "quotation" || type === "invoice") {
    const table = type === "quotation" ? "quotations" : "invoices";
    const no = type === "quotation" ? "quote_no" : "inv_no";
    let s = supabaseServer.from(table).select(`id, no:${no}, status, company:doc->>companyName, customer:doc->>customerName`);
    if (auth.tenant_id) s = s.eq("tenant_id", auth.tenant_id);
    if (q) s = s.or(`${no}.ilike.${like},doc->>companyName.ilike.${like},doc->>customerName.ilike.${like}`);
    const { data, error } = await s.order("created_at", { ascending: false }).limit(LIMIT);
    if (error) return failed(error.message);
    hits = ((data ?? []) as Array<{ id: string; no: string | null; status: string | null; company: string | null; customer: string | null }>).map((d) => ({
      id: d.id, label: d.no || "—", sub: [d.company || d.customer, d.status].filter(Boolean).join(" · ") || undefined,
    }));
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
