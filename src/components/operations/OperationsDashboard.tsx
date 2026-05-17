"use client";

/* ---------------------------------------------------------------------------
   /operations — Daily Operations Dashboard.

   Single-screen overview for operators:
     · today's shipments / receipts / pending docs / approvals
     · alerts (low stock · overdue AR/AP · pending approvals · FX missing)
     · health indicators (inventory / AR / AP / workflow)
     · bottleneck list with drill-down

   Everything is read-only; aggregated server-side from existing tables.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ErpEyebrow, ErpHairline, ErpPage, ErpPanel,
  ErpStatusDot, type ErpStatus,
} from "@/components/ui/erp/ErpUi";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

type Severity = "info" | "watch" | "risk";

interface Alert {
  key: string; category: string; severity: Severity;
  title: string; detail: string;
  count?: number; amount?: number; currency?: string | null;
  href: string; action_label?: string;
}
interface Today {
  shipments_today: number; receipts_today: number;
  invoices_pending: number; bills_pending: number;
  approvals_pending: number; low_stock: number;
}
interface Health { inventory: Severity; ar: Severity; ap: Severity; workflow: Severity }
interface Bottleneck { key: string; label: string; count: number; severity: Severity; href: string; detail: string }
interface Snapshot {
  base_currency: string;
  alerts: Alert[]; today: Today; health: Health; bottlenecks: Bottleneck[];
}

const SEV_DOT: Record<Severity, ErpStatus> = { info: "complete", watch: "started", risk: "blocked" };
const SEV_TONE: Record<Severity, string> = {
  info:  "border-emerald-400/30 bg-emerald-500/[0.06]  text-emerald-200",
  watch: "border-amber-400/30  bg-amber-500/[0.06]   text-amber-200",
  risk:  "border-rose-400/30   bg-rose-500/[0.06]    text-rose-200",
};
const SEV_LABEL: Record<Severity, string> = { info: "Healthy", watch: "Watch", risk: "Action" };

const CATEGORY_ICON: Record<string, RrIconName> = {
  stock_low: "box-open", ar_overdue: "file-invoice-dollar",
  ap_overdue: "file-invoice", approval_pending: "badge-check",
  fx_missing: "balance-scale-left", shipment_delayed: "shipping-fast",
  bottleneck: "clock",
};

function fmtAmt(n: number, ccy: string | null | undefined) {
  return `${ccy ?? ""} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function OperationsDashboard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/operations/snapshot")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setSnap(j.snapshot);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <ErpPage
      title="Operations"
      subtitle="Today's view"
      icon="signal-stream"
      backHref="/"
      action={
        <Link href="/finance/workspace"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]">
          <RrIcon name="bank" size={12} /> Workspace
        </Link>
      }
    >
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-rose-300">{error}</div>}
      {snap && (
        <>
          {/* Today */}
          <section>
            <ErpEyebrow>Today</ErpEyebrow>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <TodayCard label="Shipments today"  value={snap.today.shipments_today}   href="/sales/orders" icon="shipping-fast" />
              <TodayCard label="Receipts today"   value={snap.today.receipts_today}    href="/purchase"     icon="box-circle-check" />
              <TodayCard label="Invoices open"    value={snap.today.invoices_pending} href="/invoices"     icon="file-invoice-dollar" />
              <TodayCard label="Bills open"       value={snap.today.bills_pending}    href="/finance/suppliers" icon="file-invoice" />
              <TodayCard label="Pending approvals" value={snap.today.approvals_pending} href="/finance/approvals" icon="badge-check" />
              <TodayCard label="Low stock"        value={snap.today.low_stock}        href="/inventory?filter=low-stock" icon="box-open" />
            </div>
          </section>

          {/* Health */}
          <section>
            <ErpEyebrow>Operational Health</ErpEyebrow>
            <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <HealthPill label="Inventory" severity={snap.health.inventory} />
              <HealthPill label="Receivables" severity={snap.health.ar} />
              <HealthPill label="Payables"    severity={snap.health.ap} />
              <HealthPill label="Workflow"    severity={snap.health.workflow} />
            </div>
          </section>

          {/* Alerts */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <ErpEyebrow>Alerts ({snap.alerts.length})</ErpEyebrow>
              {snap.alerts.length === 0 && <span className="text-[10.5px] text-emerald-300">All clear</span>}
            </div>
            {snap.alerts.length === 0 ? (
              <ErpPanel className="px-4 py-6 text-center text-[12px] text-gray-500">No actionable alerts.</ErpPanel>
            ) : (
              <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {snap.alerts.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} className={`block rounded-xl border px-4 py-3 transition-opacity hover:opacity-95 ${SEV_TONE[a.severity]}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex items-center gap-2 text-[12.5px] font-semibold">
                          <RrIcon name={CATEGORY_ICON[a.category] ?? "info"} size={12} />
                          {a.title}
                        </span>
                        <span className="text-[9.5px] uppercase tracking-[0.10em]">{a.severity}</span>
                      </div>
                      <p className="mt-1 text-[11.5px]">{a.detail}</p>
                      {(a.count !== undefined || typeof a.amount === "number") && (
                        <div className="mt-2 flex items-baseline gap-3 text-[10.5px] text-gray-300">
                          {a.count !== undefined && <span><span className="text-gray-500">Count:</span> {a.count}</span>}
                          {typeof a.amount === "number" && <span><span className="text-gray-500">Amount:</span> {fmtAmt(a.amount, a.currency)}</span>}
                        </div>
                      )}
                      {a.action_label && (
                        <div className="mt-2 inline-flex items-center gap-1 text-[10.5px] underline-offset-2 hover:underline">
                          <RrIcon name="arrow-up-right" size={9} />
                          {a.action_label}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Bottlenecks */}
          {snap.bottlenecks.length > 0 && (
            <section>
              <ErpEyebrow>Workflow Bottlenecks</ErpEyebrow>
              <ErpPanel>
                <ul>
                  {snap.bottlenecks.map((b) => (
                    <li key={b.key} className="border-b border-white/[0.025] last:border-b-0">
                      <Link href={b.href} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.02]">
                        <ErpStatusDot status={SEV_DOT[b.severity]} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12.5px] font-medium">{b.label}</div>
                          <div className="text-[10.5px] text-gray-500">{b.detail}</div>
                        </div>
                        <div className="font-mono text-[12px] tabular-nums">{b.count}</div>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] ${SEV_TONE[b.severity]}`}>
                          {SEV_LABEL[b.severity]}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </ErpPanel>
            </section>
          )}
          <ErpHairline />
        </>
      )}
    </ErpPage>
  );
}

/* ─── helpers ─── */

function TodayCard({ label, value, href, icon }: { label: string; value: number; href: string; icon: RrIconName }) {
  return (
    <Link href={href} className="block">
      <ErpPanel className="px-3 py-3 transition-colors hover:bg-white/[0.025]">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-300">
            <RrIcon name={icon} size={12} />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.10em] text-gray-500">{label}</div>
            <div className="mt-0.5 font-mono text-[16px] leading-none tabular-nums">{value}</div>
          </div>
        </div>
      </ErpPanel>
    </Link>
  );
}

function HealthPill({ label, severity }: { label: string; severity: Severity }) {
  return (
    <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${SEV_TONE[severity]}`}>
      <div className="flex items-center gap-2">
        <ErpStatusDot status={SEV_DOT[severity]} />
        <span className="text-[11.5px] font-medium">{label}</span>
      </div>
      <span className="text-[9.5px] uppercase tracking-[0.10em]">{SEV_LABEL[severity]}</span>
    </div>
  );
}
