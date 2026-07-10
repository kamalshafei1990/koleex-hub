import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { resolveBaseCurrency } from "@/lib/finance/currency";

/* ---------------------------------------------------------------------------
   /api/documents — the Documents app's OWN store (separate from quotations /
   invoices). One table holds all three kinds, discriminated by `doc_kind`
   ('quotation' | 'invoice' | 'packing_list'). Tenant-scoped; service-role only.

   GET  /api/documents?doc_kind=&status=&search=   → list (slim: items stripped)
   POST /api/documents                             → upsert (mint doc_no on insert)
   --------------------------------------------------------------------------- */

type DocKind = "quotation" | "invoice" | "packing_list";
const KINDS: DocKind[] = ["quotation", "invoice", "packing_list"];
const NUM_PREFIX: Record<DocKind, string> = {
  quotation: "QT",
  invoice: "INV",
  packing_list: "PL",
};

/* Per-kind, per-tenant, per-year sequential number: e.g. QT-2026-0001.
   Kept in its own series so Documents numbers never collide with the live
   Quotations/Invoices apps. The candidate set (one year of one kind) is tiny,
   so an in-memory scan for the next free sequence is cheapest. */
async function nextDocNumber(tenantId: string, kind: DocKind, issueDate?: string): Promise<string> {
  const iso = (issueDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const year = iso.split("-")[0] || String(new Date().getFullYear());
  const base = `${NUM_PREFIX[kind]}-${year}-`;
  const { data } = await supabaseServer
    .from("documents")
    .select("doc_no")
    .eq("tenant_id", tenantId)
    .eq("doc_kind", kind)
    .ilike("doc_no", `${base}%`);
  let max = 0;
  for (const r of data ?? []) {
    const no = (r as { doc_no: string | null }).doc_no;
    if (!no) continue;
    const m = no.slice(base.length).match(/^(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${base}${String(max + 1).padStart(4, "0")}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Documents");
  if (deny) return deny;

  const url = new URL(req.url);
  const kind = url.searchParams.get("doc_kind");
  const status = url.searchParams.get("status") ?? "all";
  const search = url.searchParams.get("search")?.trim();

  let q = supabaseServer
    .from("documents")
    .select(
      `id, tenant_id, doc_kind, doc_no, title, customer_id, status, currency,
       total, issue_date, due_date, doc, version, updated_by, updated_by_name,
       created_at, updated_at`,
    )
    .eq("tenant_id", auth.tenant_id);

  if (kind && KINDS.includes(kind as DocKind)) q = q.eq("doc_kind", kind);
  if (status !== "all") q = q.eq("status", status);
  if (search) q = q.ilike("doc_no", `%${search}%`);
  q = q.order("updated_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    console.error("[api/documents GET]", error.message);
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 });
  }

  /* Strip the heavy `items` / `rows` payload from list rows — only the
     editor needs them (the /:id GET returns the full doc). */
  const slim = (data ?? []).map((row) => {
    const full = (row as { doc?: Record<string, unknown> }).doc ?? {};
    const { items: _items, rows: _rows, ...rest } = full as Record<string, unknown>;
    return { ...(row as Record<string, unknown>), doc: rest };
  });

  return NextResponse.json(
    { documents: slim },
    { headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=60" } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Documents", "create");
  if (deny) return deny;

  const body = (await req.json()) as {
    id?: string;
    doc_kind?: DocKind;
    doc_no?: string;
    title?: string | null;
    customer_id?: string | null;
    currency?: string;
    status?: string;
    issue_date?: string;
    due_date?: string | null;
    total?: number;
    doc: Record<string, unknown>;
    base_version?: number;
  };

  const kind: DocKind = KINDS.includes(body.doc_kind as DocKind) ? (body.doc_kind as DocKind) : "quotation";
  const baseCurrency = await resolveBaseCurrency(auth.tenant_id);

  // ── Update by id (optimistic-lock guarded, same discipline as quotations) ──
  if (body.id) {
    const { data: cur, error: curErr } = await supabaseServer
      .from("documents")
      .select("version, updated_by_name, updated_at, doc_no")
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 });
    if (!cur) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const currentVersion = typeof cur.version === "number" ? cur.version : 1;
    if (typeof body.base_version === "number" && body.base_version !== currentVersion) {
      return NextResponse.json(
        { status: "conflict", current: { version: currentVersion, updated_by_name: cur.updated_by_name ?? null, updated_at: cur.updated_at ?? null } },
        { status: 409 },
      );
    }
    const guardVersion = typeof body.base_version === "number" ? body.base_version : currentVersion;

    const { data, error } = await supabaseServer
      .from("documents")
      .update({
        doc_no: body.doc_no ?? cur.doc_no,
        title: body.title ?? null,
        customer_id: body.customer_id ?? null,
        currency: body.currency ?? baseCurrency,
        status: body.status ?? "draft",
        issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
        due_date: body.due_date ?? null,
        total: body.total ?? 0,
        doc: body.doc ?? {},
        version: guardVersion + 1,
        updated_by: auth.account_id,
        updated_by_name: auth.username,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .eq("tenant_id", auth.tenant_id)
      .eq("version", guardVersion)
      .select("*")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) {
      const { data: latest } = await supabaseServer
        .from("documents")
        .select("version, updated_by_name, updated_at")
        .eq("id", body.id)
        .eq("tenant_id", auth.tenant_id)
        .maybeSingle();
      return NextResponse.json(
        { status: "conflict", current: { version: latest?.version ?? currentVersion, updated_by_name: latest?.updated_by_name ?? null, updated_at: latest?.updated_at ?? null } },
        { status: 409 },
      );
    }
    return NextResponse.json({ document: data });
  }

  // ── Insert (mint a fresh per-kind doc_no) ──
  const doc_no = body.doc_no ?? (await nextDocNumber(auth.tenant_id, kind, body.issue_date));
  const { data, error } = await supabaseServer
    .from("documents")
    .insert({
      tenant_id: auth.tenant_id,
      doc_kind: kind,
      doc_no,
      title: body.title ?? null,
      customer_id: body.customer_id ?? null,
      currency: body.currency ?? baseCurrency,
      status: body.status ?? "draft",
      issue_date: body.issue_date ?? new Date().toISOString().slice(0, 10),
      due_date: body.due_date ?? null,
      total: body.total ?? 0,
      doc: body.doc ?? {},
      created_by: auth.account_id,
      updated_by: auth.account_id,
      updated_by_name: auth.username,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document: data });
}
