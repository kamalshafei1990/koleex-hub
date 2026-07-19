import "server-only";

/* POST /api/projects/from-quotation — one-click delivery project for an
   accepted quotation. Creates a project named after the quote, linked to
   the quote's customer, billable, budget_amount = quote total, with the
   standard 4 kanban stages. Idempotent: if a project with code = quote_no
   already exists it is returned with { already: true } instead of creating
   a duplicate. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Projects", "create");
  if (deny) return deny;

  const { quotation_id } = (await req.json()) as { quotation_id?: string };
  if (!quotation_id) {
    return NextResponse.json({ error: "quotation_id required" }, { status: 400 });
  }

  const { data: quote, error: qErr } = await supabaseServer
    .from("quotations")
    .select("id, quote_no, status, total, currency, customer_id")
    .eq("id", quotation_id)
    .maybeSingle();
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!quote) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });

  const code = (quote.quote_no as string | null) ?? `Q-${quotation_id.slice(0, 8)}`;

  // Idempotency: one project per quotation (matched by code).
  const { data: existing } = await supabaseServer
    .from("projects")
    .select("*")
    .eq("tenant_id", auth.tenant_id)
    .eq("code", code)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ project: existing, already: true });
  }

  const { data: project, error } = await supabaseServer
    .from("projects")
    .insert({
      tenant_id: auth.tenant_id,
      name: `Delivery — ${code}`,
      code,
      description: `Created from accepted quotation ${code}.`,
      color: "#818cf8",
      customer_id: quote.customer_id ?? null,
      manager_account_id: auth.account_id,
      is_billable: true,
      budget_amount: (quote.total as number | null) ?? null,
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error || !project) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  // Same default stages as a hand-created project.
  const defaults = [
    { name: "To Do",       color: "#94a3b8", sort: 0, closed: false, default_new: true  },
    { name: "In Progress", color: "#60a5fa", sort: 1, closed: false, default_new: false },
    { name: "Review",      color: "#fbbf24", sort: 2, closed: false, default_new: false },
    { name: "Done",        color: "#34d399", sort: 3, closed: true,  default_new: false },
  ];
  await supabaseServer.from("project_stages").insert(
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

  return NextResponse.json({ project, already: false });
}
