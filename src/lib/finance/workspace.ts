import "server-only";

/* ===========================================================================
   Finance Workspace — operator-oriented homepage snapshot.

   Single function builds everything /finance/workspace needs:
     · pending approvals  (expenses + payments + journals in draft/pending)
     · recent transactions (last 25 across expenses / payments / invoices /
                              vendor_bills / fx exchanges / journals)
     · bank account list (currency + balance + count)
     · simple counts for the navigation cards

   READ-ONLY. No accounting writes. No new tables.
   ========================================================================== */

import { supabaseServer } from "@/lib/server/supabase-server";

export interface PendingItem {
  kind: "expense" | "payment" | "bill" | "journal";
  id: string;
  ref: string;
  party_name?: string | null;
  amount: number;
  currency: string;
  submitted_at: string | null;
  href: string;
  status: string;
}

export interface RecentItem {
  kind: "expense" | "payment" | "invoice" | "bill" | "fx" | "journal";
  id: string;
  ref: string;
  party_name?: string | null;
  amount: number;
  currency: string;
  occurred_at: string;
  href: string;
}

export interface WorkspaceBank {
  id: string;
  label: string;
  currency: string;
  current_balance: number;
}

export interface WorkspaceCounts {
  expenses_open: number;
  payments_open: number;
  invoices_open: number;
  bills_open: number;
  fx_30d: number;
  journals_draft: number;
}

export interface FinanceWorkspaceSnapshot {
  base_currency: string;
  pending: PendingItem[];
  recent: RecentItem[];
  banks: WorkspaceBank[];
  counts: WorkspaceCounts;
}

const PENDING_LIMIT = 25;
const RECENT_LIMIT = 25;

export async function buildFinanceWorkspace(tenantId: string): Promise<FinanceWorkspaceSnapshot> {
  /* Base currency. */
  const tenantRes = await supabaseServer.from("tenants")
    .select("default_currency").eq("id", tenantId).maybeSingle();
  const baseCurrency = (tenantRes.data as { default_currency: string | null } | null)?.default_currency ?? "CNY";

  /* Pending — expenses + payments awaiting review/approval, plus draft journals. */
  const [expPending, payPending, jeDraft] = await Promise.all([
    supabaseServer.from("finance_expenses")
      .select("id, title, amount, currency, approval_status, submitted_at, linked_supplier_id")
      .eq("tenant_id", tenantId)
      .in("approval_status", ["draft", "submitted", "pending"]).order("submitted_at", { ascending: false }).limit(PENDING_LIMIT),
    supabaseServer.from("finance_payments")
      .select("id, reference_no, amount, currency, approval_status, submitted_at, party_name, party_type")
      .eq("tenant_id", tenantId)
      .in("approval_status", ["draft", "submitted", "pending"]).order("submitted_at", { ascending: false }).limit(PENDING_LIMIT),
    supabaseServer.from("accounting_journal_entries")
      .select("id, journal_no, entry_date, description, status")
      .eq("tenant_id", tenantId).eq("status", "draft").order("entry_date", { ascending: false }).limit(PENDING_LIMIT),
  ]);

  const pending: PendingItem[] = [];
  for (const e of (expPending.data ?? []) as Array<{
    id: string; title: string | null; amount: number; currency: string;
    approval_status: string; submitted_at: string | null; linked_supplier_id: string | null;
  }>) {
    pending.push({
      kind: "expense", id: e.id, ref: e.title ?? e.id.slice(0, 8),
      amount: Number(e.amount) || 0, currency: e.currency || baseCurrency,
      submitted_at: e.submitted_at, href: `/finance/expenses?id=${e.id}`,
      status: e.approval_status,
    });
  }
  for (const p of (payPending.data ?? []) as Array<{
    id: string; reference_no: string | null; amount: number; currency: string;
    approval_status: string; submitted_at: string | null; party_name: string | null;
  }>) {
    pending.push({
      kind: "payment", id: p.id, ref: p.reference_no ?? p.id.slice(0, 8),
      party_name: p.party_name, amount: Number(p.amount) || 0,
      currency: p.currency || baseCurrency,
      submitted_at: p.submitted_at, href: `/finance/payments?id=${p.id}`,
      status: p.approval_status,
    });
  }
  for (const j of (jeDraft.data ?? []) as Array<{
    id: string; journal_no: string; entry_date: string; description: string | null; status: string;
  }>) {
    pending.push({
      kind: "journal", id: j.id, ref: j.journal_no,
      amount: 0, currency: baseCurrency,
      submitted_at: j.entry_date, href: `/finance/accounting?journal=${j.id}`,
      status: j.status,
    });
  }
  pending.sort((a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? ""));

  /* Recent — last RECENT_LIMIT items from each kind, merged + sorted by date. */
  const [recentExp, recentPay, recentInv, recentBill, recentFx] = await Promise.all([
    supabaseServer.from("finance_expenses")
      .select("id, title, amount, currency, expense_date").eq("tenant_id", tenantId)
      .order("expense_date", { ascending: false }).limit(RECENT_LIMIT),
    supabaseServer.from("finance_payments")
      .select("id, reference_no, amount, currency, payment_date, party_name").eq("tenant_id", tenantId)
      .order("payment_date", { ascending: false }).limit(RECENT_LIMIT),
    supabaseServer.from("invoices")
      .select("id, inv_no, total, currency, issue_date, customer_id, status, cancelled_at").eq("tenant_id", tenantId)
      .order("issue_date", { ascending: false }).limit(RECENT_LIMIT),
    supabaseServer.from("vendor_bills")
      .select("id, bill_no, total, currency, bill_date, supplier_id, status").eq("tenant_id", tenantId)
      .order("bill_date", { ascending: false }).limit(RECENT_LIMIT),
    supabaseServer.from("finance_fx_exchanges")
      .select("id, exchange_no, from_amount, from_currency, exchange_date").eq("tenant_id", tenantId)
      .order("exchange_date", { ascending: false }).limit(RECENT_LIMIT),
  ]);

  const recent: RecentItem[] = [];
  for (const e of (recentExp.data ?? []) as Array<{
    id: string; title: string | null; amount: number; currency: string; expense_date: string;
  }>) {
    recent.push({
      kind: "expense", id: e.id, ref: e.title ?? e.id.slice(0, 8),
      amount: Number(e.amount) || 0, currency: e.currency || baseCurrency,
      occurred_at: e.expense_date, href: `/finance/expenses?id=${e.id}`,
    });
  }
  for (const p of (recentPay.data ?? []) as Array<{
    id: string; reference_no: string | null; amount: number; currency: string;
    payment_date: string; party_name: string | null;
  }>) {
    recent.push({
      kind: "payment", id: p.id, ref: p.reference_no ?? p.id.slice(0, 8),
      party_name: p.party_name,
      amount: Number(p.amount) || 0, currency: p.currency || baseCurrency,
      occurred_at: p.payment_date, href: `/finance/payments?id=${p.id}`,
    });
  }
  for (const i of (recentInv.data ?? []) as Array<{
    id: string; inv_no: string | null; total: number; currency: string;
    issue_date: string; customer_id: string | null; status: string; cancelled_at: string | null;
  }>) {
    if (i.cancelled_at || i.status === "draft") continue;
    recent.push({
      kind: "invoice", id: i.id, ref: i.inv_no ?? i.id.slice(0, 8),
      amount: Number(i.total) || 0, currency: i.currency || baseCurrency,
      occurred_at: i.issue_date, href: `/invoices/${i.id}`,
    });
  }
  for (const b of (recentBill.data ?? []) as Array<{
    id: string; bill_no: string | null; total: number; currency: string;
    bill_date: string; supplier_id: string; status: string;
  }>) {
    if (b.status === "draft" || b.status === "cancelled") continue;
    recent.push({
      kind: "bill", id: b.id, ref: b.bill_no ?? b.id.slice(0, 8),
      amount: Number(b.total) || 0, currency: b.currency || baseCurrency,
      occurred_at: b.bill_date, href: `/finance/suppliers?bill=${b.id}`,
    });
  }
  for (const f of (recentFx.data ?? []) as Array<{
    id: string; exchange_no: string; from_amount: number; from_currency: string; exchange_date: string;
  }>) {
    recent.push({
      kind: "fx", id: f.id, ref: f.exchange_no,
      amount: Number(f.from_amount) || 0, currency: f.from_currency || baseCurrency,
      occurred_at: f.exchange_date, href: `/finance/setup?card=fx-rates`,
    });
  }
  recent.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const recentTrim = recent.slice(0, RECENT_LIMIT);

  /* Banks. */
  const banksRes = await supabaseServer.from("finance_bank_accounts")
    .select("id, account_name, currency, current_balance").eq("tenant_id", tenantId);
  const banks: WorkspaceBank[] = ((banksRes.data ?? []) as Array<{
    id: string; account_name: string; currency: string; current_balance: number;
  }>).map((b) => ({
    id: b.id, label: b.account_name, currency: b.currency || baseCurrency,
    current_balance: Number(b.current_balance) || 0,
  }));

  /* Counts. */
  const [openExp, openPay, openInv, openBill, fx30, draftJE] = await Promise.all([
    supabaseServer.from("finance_expenses").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).in("approval_status", ["draft", "submitted", "pending"]),
    supabaseServer.from("finance_payments").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).in("approval_status", ["draft", "submitted", "pending"]),
    supabaseServer.from("invoices").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gt("balance", 0).is("cancelled_at", null),
    supabaseServer.from("vendor_bills").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gt("balance", 0),
    supabaseServer.from("finance_fx_exchanges").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).gte("exchange_date", isoNDaysAgo(30)),
    supabaseServer.from("accounting_journal_entries").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).eq("status", "draft"),
  ]);

  const counts: WorkspaceCounts = {
    expenses_open: openExp.count ?? 0,
    payments_open: openPay.count ?? 0,
    invoices_open: openInv.count ?? 0,
    bills_open:    openBill.count ?? 0,
    fx_30d:        fx30.count ?? 0,
    journals_draft: draftJE.count ?? 0,
  };

  return { base_currency: baseCurrency, pending: pending.slice(0, PENDING_LIMIT), recent: recentTrim, banks, counts };
}

function isoNDaysAgo(n: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
}
