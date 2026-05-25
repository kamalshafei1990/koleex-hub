"use client";

/* ---------------------------------------------------------------------------
   PurchaseHome — landing page at /purchase.

   Sections (mirrors the Inventory home layout so the two apps feel like
   siblings):

     1. PurchaseHeader (sticky pill nav)
     2. KPI strip — 4 cards: Open POs, Spend MTD, Outstanding Bills, Overdue
     3. Quick actions — 4 hero cards routing to the most-used flows
     4. Alerts — surfaces when something needs attention (overdue bills,
        pending approvals, late deliveries)
     5. Today's activity — 4 compact tiles (PRs, RFQs sent, POs placed,
        receipts posted)
     6. Recent activity — last 8 documents across the funnel
     7. Quick lookup — global search box

   Talks to Supabase directly via the client adapter for now; PUR-2 will
   replace these with API routes that enforce permissions + audit log.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import KpiCard from "@/components/ui/KpiCard";
import Button from "@/components/ui/Button";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PurchasePage from "./PurchasePage";
import { formatMoney, relativeTime } from "./shared";

/* ---------------------------------------------------------------------------
   Section eyebrow + small primitives reused from the Inventory home so the
   two apps share the exact visual rhythm. */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
      {children}
    </h2>
  );
}

interface QuickActionProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  tone: "blue" | "teal" | "amber" | "violet";
}
function QuickActionCard({ href, icon, label, hint, tone }: QuickActionProps) {
  const accentBar =
    tone === "blue"   ? "bg-blue-500/60" :
    tone === "teal"   ? "bg-teal-500/60" :
    tone === "amber"  ? "bg-amber-500/60" :
                        "bg-violet-500/60";
  return (
    <Link
      href={href}
      className="group relative flex h-full min-h-[120px] flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3.5 shadow-sm transition-colors hover:bg-[var(--bg-surface-hover)]"
    >
      <span aria-hidden className={`absolute left-4 top-0 h-px w-12 ${accentBar}`} />
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
          {icon}
        </span>
        <div className="text-[14px] font-medium tracking-tight text-[var(--text-primary)]">
          {label}
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-dim)]">{hint}</p>
      <div className="mt-auto pt-2 text-[11px] text-[var(--text-dim)] opacity-0 transition-opacity group-hover:opacity-100">
        →
      </div>
    </Link>
  );
}

interface AlertCardProps {
  href: string;
  label: string;
  count: number;
  tone: "rose" | "amber" | "blue";
}
function AlertCard({ href, label, count, tone }: AlertCardProps) {
  const dot =
    tone === "rose"  ? "bg-rose-500"  :
    tone === "amber" ? "bg-amber-500" :
                       "bg-blue-500";
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-surface-hover)]"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1 text-[12.5px] text-[var(--text-primary)]">{label}</div>
      <div className="text-[16px] font-medium tabular-nums text-[var(--text-primary)]">{count}</div>
    </Link>
  );
}

function TodayTile({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-surface-hover)]"
    >
      <div className="flex-1 text-[12px] text-[var(--text-muted)]">{label}</div>
      <div className="text-[15px] font-medium tabular-nums text-[var(--text-primary)]">{value}</div>
    </Link>
  );
}

/* ---------------------------------------------------------------------------
   Data model the home page assembles from raw Supabase rows. */

interface HomeStats {
  /* KPI strip */
  openPOs: number;
  openPOValue: number;
  spendMTD: number;
  outstandingBills: number;
  overdueBills: number;
  /* Alerts */
  pendingRequisitions: number;
  pendingApprovals: number;
  lateDeliveries: number;
  openRFQs: number;
  /* Today */
  todayPRs: number;
  todayRFQs: number;
  todayPOs: number;
  todayReceipts: number;
  /* Other */
  activeSuppliers: number;
}

interface RecentItem {
  id: string;
  kind: "po" | "bill" | "req" | "rfq" | "payment" | "receipt";
  label: string;
  ts: string;
  href: string;
}

export default function PurchaseHome() {
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const dayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [posR, billsR, paymentsR, reqsR, rfqsR, receiptsR, suppR] = await Promise.all([
          supabase.from("purchase_orders").select("id,po_no,supplier_id,status,total,expected_delivery_date,order_date,created_at").order("created_at", { ascending: false }).limit(100),
          supabase.from("vendor_bills").select("id,bill_no,supplier_id,status,total,balance,due_date,bill_date,created_at").order("created_at", { ascending: false }).limit(100),
          supabase.from("vendor_payments").select("id,supplier_id,amount,paid_at,created_at").order("paid_at", { ascending: false, nullsFirst: false }).limit(100),
          supabase.from("purchase_requisitions").select("id,pr_no,status,total_estimated,created_at").order("created_at", { ascending: false }).limit(50),
          supabase.from("purchase_rfqs").select("id,rfq_no,status,supplier_id,total_estimated,created_at").order("created_at", { ascending: false }).limit(50),
          supabase.from("purchase_receipts").select("id,gr_no,po_id,status,created_at").order("created_at", { ascending: false }).limit(50),
          supabase.from("contacts").select("id,supplier_type,is_active").not("supplier_type", "is", null),
        ]);
        if (cancelled) return;

        const pos      = posR.data ?? [];
        const bills    = billsR.data ?? [];
        const payments = paymentsR.data ?? [];
        const reqs     = reqsR.data ?? [];
        const rfqs     = rfqsR.data ?? [];
        const receipts = receiptsR.data ?? [];
        const supps    = suppR.data ?? [];

        const lc = (s: string | null | undefined) => (s ?? "").toLowerCase();

        const openPOs = pos.filter((p) => !["closed", "cancelled", "received"].includes(lc(p.status)));
        const openPOValue = openPOs.reduce((a, p) => a + (Number(p.total) || 0), 0);

        const spendMTD = payments
          .filter((p) => p.paid_at && new Date(p.paid_at) >= monthStart)
          .reduce((a, p) => a + (Number(p.amount) || 0), 0);

        const outstandingBills = bills.reduce((a, b) => a + (Number(b.balance) || 0), 0);
        const overdueBills = bills.filter((b) =>
          b.due_date && new Date(b.due_date) < now &&
          Number(b.balance) > 0 &&
          !["paid", "cancelled"].includes(lc(b.status)),
        ).length;

        const pendingRequisitions = reqs.filter((r) => ["draft", "pending"].includes(lc(r.status))).length;
        const pendingApprovals = reqs.filter((r) => lc(r.status) === "pending").length;
        const lateDeliveries = openPOs.filter((p) =>
          p.expected_delivery_date && new Date(p.expected_delivery_date) < now,
        ).length;
        const openRFQs = rfqs.filter((r) => ["draft", "sent", "responded"].includes(lc(r.status))).length;

        const isToday = (iso: string | null | undefined) => !!iso && new Date(iso) >= dayStart;
        const todayPRs      = reqs.filter((r) => isToday(r.created_at)).length;
        const todayRFQs     = rfqs.filter((r) => isToday(r.created_at)).length;
        const todayPOs      = pos.filter((p) => isToday(p.created_at)).length;
        const todayReceipts = receipts.filter((r) => isToday(r.created_at)).length;

        const activeSuppliers = supps.filter((s) => s.is_active !== false).length;

        setStats({
          openPOs: openPOs.length,
          openPOValue,
          spendMTD,
          outstandingBills,
          overdueBills,
          pendingRequisitions,
          pendingApprovals,
          lateDeliveries,
          openRFQs,
          todayPRs,
          todayRFQs,
          todayPOs,
          todayReceipts,
          activeSuppliers,
        });

        const feed: RecentItem[] = [];
        for (const p of pos.slice(0, 4))      feed.push({ id: p.id, kind: "po",      label: `PO ${p.po_no || ""} — ${formatMoney(Number(p.total) || 0)}`, ts: p.created_at, href: "/purchase/orders" });
        for (const b of bills.slice(0, 4))    feed.push({ id: b.id, kind: "bill",    label: `Bill ${b.bill_no || ""} — ${formatMoney(Number(b.total) || 0)}`, ts: b.created_at, href: "/purchase/bills" });
        for (const r of reqs.slice(0, 3))     feed.push({ id: r.id, kind: "req",     label: `Requisition ${r.pr_no || ""}`, ts: r.created_at, href: "/purchase/requisitions" });
        for (const r of rfqs.slice(0, 3))     feed.push({ id: r.id, kind: "rfq",     label: `RFQ ${r.rfq_no || ""}`, ts: r.created_at, href: "/purchase/rfqs" });
        for (const r of receipts.slice(0, 3)) feed.push({ id: r.id, kind: "receipt", label: `Receipt ${r.gr_no || ""}`, ts: r.created_at, href: "/purchase/receipts" });
        for (const p of payments.slice(0, 2)) feed.push({ id: p.id, kind: "payment", label: `Payment — ${formatMoney(Number(p.amount) || 0)}`, ts: p.created_at, href: "/purchase/payments" });
        feed.sort((a, b) => (a.ts < b.ts ? 1 : -1));
        setRecent(feed.slice(0, 10));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* Loading shimmer — same shape as Inventory home so the transition
     between apps feels consistent. */
  if (loading || !stats) {
    return (
      <PurchasePage title="Purchase" subtitle="From requisition to payment — the full procure-to-pay loop.">
        <div className="flex items-center justify-center py-20 text-[var(--text-dim)]">
          <SpinnerIcon size={20} className="animate-spin" />
        </div>
      </PurchasePage>
    );
  }

  const totalAlerts = stats.overdueBills + stats.pendingApprovals + stats.lateDeliveries;

  return (
    <PurchasePage
      title="Purchase"
      subtitle="From requisition to payment — the full procure-to-pay loop."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" icon="search" onClick={() => { window.location.href = "/inventory/search"; }}>
            Search
          </Button>
          <Button variant="primary" size="sm" icon="plus" onClick={() => { window.location.href = "/purchase/orders?create=1"; }}>
            New PO
          </Button>
        </div>
      }
    >
      {/* ── 1. KPI strip ─────────────────────────────────────────── */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon="box-open"
            label="Open Orders"
            value={String(stats.openPOs)}
            hint={formatMoney(stats.openPOValue)}
            href="/purchase/orders"
          />
          <KpiCard
            icon="wallet"
            label="Spend (MTD)"
            value={formatMoney(stats.spendMTD)}
            hint="Paid this month"
            href="/purchase/payments"
          />
          <KpiCard
            icon="file-invoice"
            label="Outstanding"
            value={formatMoney(stats.outstandingBills)}
            hint="Unpaid balances"
            href="/purchase/bills"
          />
          <KpiCard
            icon="info"
            label="Overdue Bills"
            value={String(stats.overdueBills)}
            hint="Past due"
            tone={stats.overdueBills > 0 ? "rose" : "default"}
            href="/purchase/bills"
          />
        </div>
      </section>

      {/* ── 2. Quick actions ────────────────────────────────────── */}
      <section>
        <SectionEyebrow>Quick Actions</SectionEyebrow>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickActionCard
            href="/purchase/requisitions?create=1"
            icon={<span className="text-[16px] font-bold">＋</span>}
            label="New Requisition"
            hint="Start an internal purchase request"
            tone="blue"
          />
          <QuickActionCard
            href="/purchase/rfqs?create=1"
            icon={<span className="text-[16px] font-bold">？</span>}
            label="Send RFQ"
            hint="Request quotes from suppliers"
            tone="teal"
          />
          <QuickActionCard
            href="/purchase/orders?create=1"
            icon={<span className="text-[16px] font-bold">📦</span>}
            label="Create PO"
            hint="Confirm a buy with a supplier"
            tone="amber"
          />
          <QuickActionCard
            href="/purchase/payments?create=1"
            icon={<span className="text-[16px] font-bold">$</span>}
            label="Record Payment"
            hint="Pay an outstanding vendor bill"
            tone="violet"
          />
        </div>
      </section>

      {/* ── 3. Alerts — only when something needs attention ─────── */}
      {totalAlerts > 0 && (
        <section>
          <SectionEyebrow>Needs Attention</SectionEyebrow>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.overdueBills > 0 && (
              <AlertCard href="/purchase/bills?status=overdue" label="Overdue vendor bills" count={stats.overdueBills} tone="rose" />
            )}
            {stats.pendingApprovals > 0 && (
              <AlertCard href="/purchase/requisitions?status=pending" label="Requisitions awaiting approval" count={stats.pendingApprovals} tone="amber" />
            )}
            {stats.lateDeliveries > 0 && (
              <AlertCard href="/purchase/orders?status=late" label="Late deliveries" count={stats.lateDeliveries} tone="amber" />
            )}
            {stats.openRFQs > 0 && (
              <AlertCard href="/purchase/rfqs" label="Open RFQs" count={stats.openRFQs} tone="blue" />
            )}
          </div>
        </section>
      )}

      {/* ── 4. Today's activity ─────────────────────────────────── */}
      <section>
        <SectionEyebrow>Today</SectionEyebrow>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TodayTile label="Requisitions" value={stats.todayPRs}      href="/purchase/requisitions" />
          <TodayTile label="RFQs sent"    value={stats.todayRFQs}     href="/purchase/rfqs" />
          <TodayTile label="POs placed"   value={stats.todayPOs}      href="/purchase/orders" />
          <TodayTile label="Receipts"     value={stats.todayReceipts} href="/purchase/receipts" />
        </div>
      </section>

      {/* ── 5. Recent activity ──────────────────────────────────── */}
      <section>
        <SectionEyebrow>Recent</SectionEyebrow>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-6 py-10 text-center text-[12px] text-[var(--text-dim)]">
            No purchase activity yet. Start with a requisition or PO above.
          </div>
        ) : (
          <ul className="space-y-1">
            {recent.map((r) => (
              <li key={r.kind + r.id}>
                <Link
                  href={r.href}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--bg-surface)]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex h-5 items-center rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] shrink-0">
                      {r.kind}
                    </span>
                    <span className="truncate text-[13px] text-[var(--text-primary)]">{r.label}</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--text-dim)] tabular-nums">{relativeTime(r.ts)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PurchasePage>
  );
}
