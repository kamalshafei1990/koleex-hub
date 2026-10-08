import "server-only";

/* POST /api/projects/from-quotation — one-click delivery project for an
   ACCEPTED quotation. Creates a project named after the quote, linked to
   the quote's customer, billable, budget_amount = quote total, with the
   standard 4 kanban stages.

   Guards (audit 2026-09-25):
     · Projects:create AND Quotations access — the caller must be allowed
       to see the quote they are converting.
     · The quote is loaded TENANT-SCOPED (it was not, so any tenant's quote
       id could be converted).
     · Only status "accepted" converts (the Quotations UI only offers the
       button then; the server now agrees).
     · Idempotent on projects.source_quotation_id (unique per tenant) —
       NOT on code, which a user can edit or reuse. Requires migration
       supabase/migrations/20260925_projects_audit.sql. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess, requireModuleAction } from "@/lib/server/auth";
import { UUID_RE } from "@/lib/server/project-access";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "create");
  if (deny) return deny;
  const denyQ = await requireModuleAccess(auth, "Quotations");
  if (denyQ) return denyQ;

  const { quotation_id } = (await req.json().catch(() => ({}))) as { quotation_id?: string };
  if (!quotation_id || !UUID_RE.test(quotation_id)) {
    return NextResponse.json({ error: "quotation_id required" }, { status: 400 });
  }

  const { data: quote, error: qErr } = await supabaseServer
    .from("quotations")
    .select("id, quote_no, status, total, currency, customer_id")
    .eq("id", quotation_id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (qErr) {
    console.error("[api/projects/from-quotation] load:", qErr.message);
    return NextResponse.json({ error: "Failed to load quotation" }, { status: 500 });
  }
  if (!quote) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  if (quote.status !== "accepted") {
    return NextResponse.json({ error: "Only an accepted quotation can become a project" }, { status: 409 });
  }

  // Idempotency: one project per quotation.
  const { data: existing, error: exErr } = await supabaseServer
    .from("projects")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("source_quotation_id", quotation_id)
    .maybeSingle();
  if (exErr) {
    console.error("[api/projects/from-quotation] dedupe:", exErr.message);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ project: existing, already: true });
  }

  const code = (quote.quote_no as string | null) ?? `Q-${quotation_id.slice(0, 8)}`;
  const { data: project, error } = await supabaseServer
    .from("projects")
    .insert({
      tenant_id: auth.tenant_id,
      name: `Delivery — ${code}`,
      code,
      description: `Created from accepted quotation ${code}.`,
      color: "#567FB2",
      customer_id: quote.customer_id ?? null,
      manager_account_id: auth.account_id,
      is_billable: true,
      budget_amount: (quote.total as number | null) ?? null,
      created_by_account_id: auth.account_id,
      source_quotation_id: quotation_id,
    })
    .select("*")
    .single();
  if (error || !project) {
    /* 23505 = the unique index caught a concurrent double-click. */
    if (error?.code === "23505") {
      const { data: again } = await supabaseServer
        .from("projects").select("*").eq("tenant_id", auth.tenant_id).eq("source_quotation_id", quotation_id).maybeSingle();
      if (again) return NextResponse.json({ project: again, already: true });
    }
    console.error("[api/projects/from-quotation] insert:", error?.message);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }

  // Same default stages as a hand-created project.
  const defaults = [
    { name: "To Do",       color: "#94a3b8", sort: 0, closed: false, default_new: true  },
    { name: "In Progress", color: "#60a5fa", sort: 1, closed: false, default_new: false },
    { name: "Review",      color: "#fbbf24", sort: 2, closed: false, default_new: false },
    { name: "Done",        color: "#34d399", sort: 3, closed: true,  default_new: false },
  ];
  const { error: sErr } = await supabaseServer.from("project_stages").insert(
    defaults.map((d) => ({
      tenant_id: auth.tenant_id,
      project_id: project.id,
      name: d.name,
      color: d.color,
      sort_order: d.sort,
      is_closed: d.closed,
      is_default_new: d.default_new,
    })),
  );
  if (sErr) console.error("[api/projects/from-quotation] stages:", sErr.message);

  return NextResponse.json({ project, already: false });
}
