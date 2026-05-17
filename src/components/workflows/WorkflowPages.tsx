"use client";

/* ---------------------------------------------------------------------------
   Workflow pages — Procurement / Sales / Finance / Inventory.

   Each page renders the same shape so the user always knows where to
   look: header → stage timeline → quick actions → recent activity.
   The timeline status uses real counts from /api/workflows/status so a
   stage lights up whenever the user has data sitting at that step.

   No business logic, no engine work — pure navigation surface.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import {
  ErpEyebrow, ErpHairline, ErpKpi, ErpPage,
  ErpQuickAction, ErpStageTimeline,
  type ErpStatus, type WorkflowStage,
} from "@/components/ui/erp/ErpUi";

interface StatusPayload {
  procurement: Record<string, number>;
  sales: Record<string, number>;
  finance: Record<string, number>;
  inventory: Record<string, number>;
}

function pickStatus(count: number): ErpStatus {
  if (count > 0) return "started";
  return "empty";
}

/* ─── Procurement ─────────────────────────────────────────── */

export function ProcurementWorkflow() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  useEffect(() => { void load(setStatus); }, []);
  const p = status?.procurement ?? {};

  const totalDraftPo = Number(p.po_draft ?? 0);
  const totalActivePo = Number(p.po_confirmed ?? 0) + Number(p.po_partial ?? 0);

  const stages: WorkflowStage[] = [
    { key: "requisition", label: "Requisition",   icon: "file-invoice",  href: "/purchase",            status: "empty",                                    hint: "—" },
    { key: "po",          label: "Purchase Order", icon: "contract",      href: "/purchase",            status: pickStatus(totalActivePo + totalDraftPo),    hint: `${totalActivePo} active · ${totalDraftPo} draft` },
    { key: "receiving",   label: "Receiving",      icon: "box-circle-check", href: "/purchase",         status: pickStatus(Number(p.receipts_posted ?? 0)), hint: `${p.receipts_posted ?? 0} posted` },
    { key: "bill",        label: "Vendor Bill",    icon: "file-invoice-dollar", href: "/purchase",      status: pickStatus(Number(p.bills_posted ?? 0)),    hint: `${p.bills_draft ?? 0} draft · ${p.bills_posted ?? 0} posted` },
    { key: "payment",     label: "Payment",        icon: "wallet",        href: "/finance/payments",    status: pickStatus(Number(p.payments_out ?? 0)),    hint: `${p.payments_out ?? 0} payments out` },
  ];

  return (
    <ErpPage title="Procurement Workflow" subtitle="From requisition to supplier payment." icon="box-circle-check" backHref="/workflows">
      <Stage stages={stages} />
      <ErpHairline />
      <Section title="Quick actions">
        <ErpQuickAction href="/purchase"       icon="contract"          label="Open Purchase app"     hint="See all POs, receipts, and bills" />
        <ErpQuickAction href="/finance/payments" icon="wallet"          label="Pay a supplier"        hint="Record an outgoing payment" />
        <ErpQuickAction href="/finance/accounting/queue" icon="clock"   label="Accounting Queue"      hint="Review COGS + expense drafts" />
      </Section>
    </ErpPage>
  );
}

/* ─── Sales ───────────────────────────────────────────────── */

export function SalesWorkflow() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  useEffect(() => { void load(setStatus); }, []);
  const s = status?.sales ?? {};

  const totalDraftSo = Number(s.so_draft ?? 0);
  const totalActiveSo = Number(s.so_confirmed ?? 0) + Number(s.so_partial ?? 0);

  const stages: WorkflowStage[] = [
    { key: "quotation", label: "Quotation",   icon: "file-invoice",        href: "/quotations",        status: "empty",                                       hint: "—" },
    { key: "so",        label: "Sales Order", icon: "contract",            href: "/sales/orders",      status: pickStatus(totalActiveSo + totalDraftSo),     hint: `${totalActiveSo} active · ${totalDraftSo} draft` },
    { key: "shipment",  label: "Shipment",    icon: "truck-side",          href: "/sales/orders",      status: pickStatus(Number(s.shipments_posted ?? 0)),  hint: `${s.shipments_posted ?? 0} shipped` },
    { key: "invoice",   label: "Invoice",     icon: "file-invoice-dollar", href: "/invoices",          status: pickStatus(Number(s.invoices_issued ?? 0)),   hint: `${s.invoices_issued ?? 0} issued · ${s.invoices_paid ?? 0} paid` },
    { key: "payment",   label: "Payment",     icon: "wallet",              href: "/finance/payments",  status: pickStatus(Number(s.payments_in ?? 0)),       hint: `${s.payments_in ?? 0} payments in` },
  ];

  return (
    <ErpPage title="Sales Workflow" subtitle="From quotation to customer collection." icon="contract" backHref="/workflows">
      <Stage stages={stages} />
      <ErpHairline />
      <Section title="Quick actions">
        <ErpQuickAction href="/sales/orders"        icon="contract"               label="Sales Orders"        hint="Create, ship, void" />
        <ErpQuickAction href="/invoices"            icon="file-invoice-dollar"    label="Invoices"            hint="Issue + collect" />
        <ErpQuickAction href="/finance/accounting/queue" icon="clock"             label="Accounting Queue"    hint="Review revenue + COGS drafts" />
      </Section>
    </ErpPage>
  );
}

/* ─── Finance ─────────────────────────────────────────────── */

export function FinanceWorkflow() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  useEffect(() => { void load(setStatus); }, []);
  const f = status?.finance ?? {};

  const stages: WorkflowStage[] = [
    { key: "expense",   label: "Expense",      icon: "receipt",             href: "/expenses",                   status: pickStatus(Number(f.expenses_draft ?? 0)),   hint: `${f.expenses_draft ?? 0} draft` },
    { key: "approval",  label: "Approval",     icon: "shield-check",        href: "/expenses",                   status: pickStatus(Number(f.expenses_submitted ?? 0)), hint: `${f.expenses_submitted ?? 0} pending · ${f.expenses_approved ?? 0} approved` },
    { key: "payment",   label: "Payment",      icon: "wallet",              href: "/finance/payments",           status: "empty",                                      hint: "—" },
    { key: "journal",   label: "Journal",      icon: "file-invoice",        href: "/finance/accounting/queue",   status: pickStatus(Number(f.journals_draft ?? 0)),    hint: `${f.journals_draft ?? 0} drafts` },
    { key: "reports",   label: "Reports",      icon: "balance-scale-left",  href: "/finance/statements",         status: "empty",                                      hint: "—" },
  ];

  return (
    <ErpPage title="Finance Workflow" subtitle="From expense capture to posted journal and reports." icon="wallet" backHref="/workflows">
      <Stage stages={stages} />
      <ErpHairline />
      <Section title="Quick actions">
        <ErpQuickAction href="/expenses"                 icon="receipt"              label="Record expense"      hint="Capture an OPEX item" />
        <ErpQuickAction href="/finance/accounting/queue" icon="clock"                label="Accounting Queue"    hint="Draft / post / void entries" />
        <ErpQuickAction href="/finance/statements"       icon="balance-scale-left"   label="Statements"          hint="P&L · BS · CF · aging · gross profit" />
        <ErpQuickAction href="/finance/setup"            icon="shield-check"         label="Setup"               hint="Base currency · banks · FX · opening balances" />
      </Section>
    </ErpPage>
  );
}

/* ─── Inventory ──────────────────────────────────────────── */

export function InventoryWorkflow() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  useEffect(() => { void load(setStatus); }, []);
  const i = status?.inventory ?? {};

  const stages: WorkflowStage[] = [
    { key: "receive",  label: "Receive",   icon: "box-circle-check", href: "/purchase",            status: "empty",                                          hint: "Receive against a PO" },
    { key: "items",    label: "Items",     icon: "box-open",         href: "/inventory/items",     status: pickStatus(Number(i.items ?? 0)),                hint: `${i.items ?? 0} items` },
    { key: "move",     label: "Move",      icon: "delivery-truck",   href: "/inventory/movements", status: pickStatus(Number(i.movements ?? 0)),            hint: `${i.movements ?? 0} movements` },
    { key: "ship",     label: "Ship",      icon: "truck-side",       href: "/sales/orders",        status: "empty",                                          hint: "Ship a SO" },
    { key: "value",    label: "Value",     icon: "badge-check",      href: "/inventory/balances",  status: pickStatus(Number(i.valuation ?? 0)),            hint: `${i.balances ?? 0} balances` },
  ];

  return (
    <ErpPage title="Inventory Workflow" subtitle="Receive → move → adjust → ship → value." icon="box-open" backHref="/workflows">
      <Stage stages={stages} />
      <ErpHairline />
      <Section title="Quick actions">
        <ErpQuickAction href="/inventory"             icon="coins"          label="Inventory Dashboard" hint="At-a-glance inventory state" />
        <ErpQuickAction href="/inventory/items"       icon="box-open"       label="Items"               hint="Universal item master" />
        <ErpQuickAction href="/inventory/movements"   icon="file-invoice"   label="Stock Movements"     hint="Append-only ledger" />
        <ErpQuickAction href="/inventory/warehouses"  icon="bank"           label="Warehouses"          hint="Physical + virtual locations" />
      </Section>
    </ErpPage>
  );
}

/* ─── Hub ─────────────────────────────────────────────────── */

export function WorkflowsHub() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  useEffect(() => { void load(setStatus); }, []);

  return (
    <ErpPage title="Workflows" subtitle="The shortest path from operational event to financial truth." icon="contract" backHref="/">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ErpKpi label="Procurement"
          value={String((status?.procurement.po_confirmed ?? 0) + (status?.procurement.po_partial ?? 0))}
          hint="Active POs"
          tone="info"
        />
        <ErpKpi label="Sales"
          value={String((status?.sales.so_confirmed ?? 0) + (status?.sales.so_partial ?? 0))}
          hint="Active SOs"
          tone="positive"
        />
        <ErpKpi label="Finance"
          value={String(status?.finance.journals_draft ?? 0)}
          hint="Draft journals awaiting review"
          tone="warning"
        />
        <ErpKpi label="Inventory"
          value={String(status?.inventory.items ?? 0)}
          hint="Inventory items"
        />
      </div>
      <ErpHairline />
      <Section title="Pick a workflow">
        <ErpQuickAction href="/workflows/procurement" icon="box-circle-check"        label="Procurement"
          hint="PR → PO → Receiving → Bill → Payment" />
        <ErpQuickAction href="/workflows/sales"       icon="contract"                label="Sales"
          hint="Quotation → SO → Shipment → Invoice → Payment" />
        <ErpQuickAction href="/workflows/finance"     icon="wallet"                  label="Finance"
          hint="Expense → Approval → Payment → Journal → Reports" />
        <ErpQuickAction href="/workflows/inventory"   icon="box-open"                label="Inventory"
          hint="Receive → Move → Adjust → Ship → Value" />
      </Section>
    </ErpPage>
  );
}

/* ─── Internals ──────────────────────────────────────────── */

async function load(set: (s: StatusPayload) => void) {
  try {
    const r = await fetch("/api/workflows/status", { credentials: "include", cache: "no-store" });
    const j = (await r.json()) as StatusPayload;
    if (r.ok) set(j);
  } catch { /* noop */ }
}

function Stage({ stages }: { stages: WorkflowStage[] }) {
  return (
    <section>
      <ErpEyebrow>Stages</ErpEyebrow>
      <div className="mt-3">
        <ErpStageTimeline stages={stages} />
      </div>
    </section>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <ErpEyebrow>{title}</ErpEyebrow>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
