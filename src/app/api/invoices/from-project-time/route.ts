import "server-only";

/* POST /api/invoices/from-project-time — time & materials billing.
   Collects the project's UNBILLED time entries (invoiced_invoice_id null),
   groups them per task, and creates a draft invoice with one line per task
   (qty = hours, unit price = projects.billing_rate). Entries are stamped
   with the invoice id so a second run only bills NEW time. */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAction } from "@/lib/server/auth";
import { calcInvoiceTotals, type LineInput } from "@/lib/server/invoice-totals";
import { resolveBaseCurrency } from "@/lib/finance/currency";

async function nextInvoiceNumber(tenantId: string): Promise<string> {
  // Mirrors /api/invoices POST so both entry points share one number line.
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${ym}-`;
  const { data } = await supabaseServer
    .from("invoices")
    .select("inv_no")
    .eq("tenant_id", tenantId)
    .ilike("inv_no", `${prefix}%`)
    .order("inv_no", { ascending: false })
    .limit(1);
  const last = data?.[0]?.inv_no as string | undefined;
  const nextSeq = last ? Number(last.replace(prefix, "")) + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAction(auth, "Invoices", "create");
  if (deny) return deny;

  const { project_id } = (await req.json()) as { project_id?: string };
  if (!project_id) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const { data: project } = await supabaseServer
    .from("projects")
    .select("id, name, code, customer_id, is_billable, billing_rate")
    .eq("id", project_id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!project.billing_rate || Number(project.billing_rate) <= 0) {
    return NextResponse.json(
      { error: "Set a billing rate on the project first (edit project → Billing rate / hour)." },
      { status: 400 },
    );
  }

  const { data: entries } = await supabaseServer
    .from("project_time_entries")
    .select("id, task_id, minutes, entry_date")
    .eq("tenant_id", auth.tenant_id)
    .eq("project_id", project_id)
    .is("invoiced_invoice_id", null)
    .limit(2000);
  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: "No unbilled time entries on this project." }, { status: 400 });
  }

  // One invoice line per task (plus one for untasked time).
  const byTask = new Map<string, { minutes: number }>();
  for (const e of entries) {
    const k = (e.task_id as string | null) ?? "__general__";
    const acc = byTask.get(k) ?? { minutes: 0 };
    acc.minutes += Number(e.minutes) || 0;
    byTask.set(k, acc);
  }
  const taskIds = [...byTask.keys()].filter((k) => k !== "__general__");
  const titles = new Map<string, string>();
  if (taskIds.length) {
    const { data: tasks } = await supabaseServer
      .from("project_tasks")
      .select("id, title")
      .in("id", taskIds);
    for (const t of tasks ?? []) titles.set(t.id as string, t.title as string);
  }

  const rate = Number(project.billing_rate);
  const lines: LineInput[] = [...byTask.entries()]
    .map(([k, v]) => ({
      description:
        k === "__general__"
          ? `${project.name} — project time`
          : `${titles.get(k) ?? "Task"} — logged time`,
      qty: Math.round((v.minutes / 60) * 100) / 100,
      unit_price: rate,
    }))
    .filter((l) => l.qty > 0);
  if (lines.length === 0) {
    return NextResponse.json({ error: "No billable hours found." }, { status: 400 });
  }

  const { hydrated, subtotal, tax_total, discount_total, total } = calcInvoiceTotals(lines, 0, 0);
  const inv_no = await nextInvoiceNumber(auth.tenant_id);
  const currency = await resolveBaseCurrency(auth.tenant_id);

  const { data: invoice, error } = await supabaseServer
    .from("invoices")
    .insert({
      tenant_id: auth.tenant_id,
      inv_no,
      customer_id: project.customer_id ?? null,
      currency,
      issue_date: new Date().toISOString().slice(0, 10),
      tax_rate: 0,
      discount_percent: 0,
      subtotal,
      tax_total,
      discount_total,
      total,
      balance: total,
      amount_paid: 0,
      notes: `Time & materials — ${project.name}${project.code ? ` (${project.code})` : ""}.`,
      linked_project_id: project.id,
      status: "draft",
      created_by_account_id: auth.account_id,
    })
    .select("*")
    .single();
  if (error || !invoice) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  if (hydrated.length > 0) {
    await supabaseServer
      .from("invoice_items")
      .insert(hydrated.map((h) => ({ ...h, invoice_id: invoice.id })));
  }

  // Stamp the billed entries so they never invoice twice.
  await supabaseServer
    .from("project_time_entries")
    .update({ invoiced_invoice_id: invoice.id })
    .in("id", entries.map((e) => e.id as string));

  const hours = Math.round((entries.reduce((s, e) => s + (Number(e.minutes) || 0), 0) / 60) * 100) / 100;
  return NextResponse.json({ invoice, hours, entries: entries.length });
}
