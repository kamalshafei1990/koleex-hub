"use client";

/* ---------------------------------------------------------------------------
   TraceabilityPanel — drop-in for any document detail page (SO / PO /
   Invoice / Bill).

   Shows three blocks:
     · Relationship Timeline   — chronological event chain with state
                                  badges + hyperlinks
     · Financial Impact        — accounting · inventory · payments · FX
     · Related Documents       — quick links to every connected doc
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { ErpEyebrow, ErpHairline, ErpPanel } from "@/components/ui/erp/ErpUi";

type Kind = "so" | "po" | "invoice" | "bill";

interface TimelineEvent {
  key: string;
  occurred_at: string;
  kind: string;
  ref: string;
  label: string;
  status: string;
  state: "done" | "current" | "pending";
  href: string;
}
interface RelatedDoc { kind: string; id: string; ref: string; status: string; href: string }
interface FinancialImpact {
  accounting: Array<{ ref: string; status: string; amount: number; currency: string; href: string }>;
  inventory:  Array<{ ref: string; warehouse: string | null; qty: number; direction: "in" | "out"; href: string }>;
  payments:   Array<{ ref: string; direction: "in" | "out"; amount: number; currency: string; status: string; date: string; href: string }>;
  fx:         { applied: boolean; rate: number | null; base_currency: string | null; base_amount: number | null };
}
interface Trace {
  doc: { kind: Kind; id: string; ref: string; status: string };
  timeline: TimelineEvent[];
  related: RelatedDoc[];
  impacts: FinancialImpact;
  outstanding: string[];
}

const KIND_ICON: Record<string, RrIconName> = {
  quotation: "contract", so: "file-invoice-dollar", po: "shipping-fast",
  shipment: "shipping-fast", receipt: "box-circle-check",
  invoice: "receipt", bill: "file-invoice",
  payment: "money", journal: "books", stock: "box-open",
};

function fmtAmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function fmtDate(iso: string) { return iso.slice(0, 10); }

export default function TraceabilityPanel({ kind, id }: { kind: Kind; id: string }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/traceability/${kind}/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setTrace(j.trace);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [kind, id]);

  if (loading) return <div className="text-[11.5px] text-gray-500">Loading traceability…</div>;
  if (error)   return <div className="text-[11.5px] text-rose-300">{error}</div>;
  if (!trace)  return null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* Timeline */}
      <ErpPanel className="p-4 lg:col-span-2">
        <div className="mb-2 flex items-baseline justify-between">
          <ErpEyebrow>Relationship Timeline</ErpEyebrow>
          <span className="text-[10px] text-gray-500">{trace.timeline.length} events</span>
        </div>
        <ErpHairline />
        {trace.timeline.length === 0 ? (
          <div className="px-1 py-4 text-[11.5px] text-gray-500">No related events yet.</div>
        ) : (
          <ol className="mt-2 space-y-1.5">
            {trace.timeline.map((e) => (
              <li key={e.key}>
                <Link href={e.href} className="flex items-center gap-3 rounded-md px-1.5 py-1.5 hover:bg-white/[0.025]">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${dotCls(e.state)}`}>
                    <RrIcon name={KIND_ICON[e.kind] ?? "info"} size={11} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-medium">{e.label}</span>
                      <span className="text-[10.5px] text-gray-500">{fmtDate(e.occurred_at)}</span>
                    </div>
                    <div className="flex items-baseline gap-2 text-[10.5px] text-gray-500">
                      <span className="font-mono">{e.ref}</span>
                      <span>·</span>
                      <span>{e.status}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </ErpPanel>

      {/* Right column: financial impact + related */}
      <div className="space-y-3">
        <ErpPanel className="p-4">
          <ErpEyebrow>Financial Impact</ErpEyebrow>
          <ErpHairline className="mt-2" />
          <Block icon="books" tone="amber" title="Accounting">
            {trace.impacts.accounting.length === 0 ? (
              <Muted>No journal yet.</Muted>
            ) : (
              <ul className="text-[11.5px]">
                {trace.impacts.accounting.map((a) => (
                  <li key={a.ref}>
                    <Link href={a.href} className="flex justify-between hover:underline">
                      <span>{a.ref}</span>
                      <span className="text-[10.5px] text-gray-500">{a.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block icon="box-open" tone="blue" title="Inventory">
            {trace.impacts.inventory.length === 0 ? (
              <Muted>No stock movement.</Muted>
            ) : (
              <ul className="text-[11.5px]">
                {trace.impacts.inventory.map((m) => (
                  <li key={m.ref}>
                    <Link href={m.href} className="flex justify-between hover:underline">
                      <span>{m.ref}</span>
                      <span className="text-[10.5px] text-gray-500">{m.direction === "in" ? "↓ in" : "↑ out"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block icon="money" tone="neutral" title="Payments">
            {trace.impacts.payments.length === 0 ? (
              <Muted>None recorded.</Muted>
            ) : (
              <ul className="text-[11.5px]">
                {trace.impacts.payments.map((p) => (
                  <li key={p.ref}>
                    <Link href={p.href} className="flex justify-between hover:underline">
                      <span>{p.ref}</span>
                      <span className="font-mono text-[10.5px]">{p.currency} {fmtAmt(p.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block icon="balance-scale-left" tone="neutral" title="FX">
            {trace.impacts.fx.applied ? (
              <div className="text-[11.5px]">
                Rate <span className="font-mono">{trace.impacts.fx.rate?.toFixed(4)}</span>{" "}
                · base {trace.impacts.fx.base_currency}{" "}
                {typeof trace.impacts.fx.base_amount === "number" && (
                  <span className="font-mono">{fmtAmt(trace.impacts.fx.base_amount)}</span>
                )}
              </div>
            ) : <Muted>None (base currency).</Muted>}
          </Block>
        </ErpPanel>

        {trace.outstanding.length > 0 && (
          <ErpPanel className="p-4">
            <ErpEyebrow>Outstanding</ErpEyebrow>
            <ul className="mt-2 space-y-1 text-[11.5px] text-amber-200/90">
              {trace.outstanding.map((o) => (
                <li key={o} className="flex items-baseline gap-1.5">
                  <RrIcon name="flag-alt" size={9} />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </ErpPanel>
        )}

        <ErpPanel className="p-4">
          <ErpEyebrow>Related Documents</ErpEyebrow>
          <ErpHairline className="mt-2" />
          {trace.related.length === 0 ? (
            <div className="mt-2 text-[11.5px] text-gray-500">No related documents.</div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {trace.related.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <Link href={r.href} className="flex items-center justify-between rounded-md px-1 py-1 text-[11.5px] hover:bg-white/[0.025]">
                    <span className="flex items-center gap-2">
                      <RrIcon name={KIND_ICON[r.kind] ?? "info"} size={10} />
                      <span className="font-mono text-[10.5px] text-gray-400">{r.ref}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.06em] text-gray-500">{r.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </ErpPanel>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function dotCls(state: TimelineEvent["state"]): string {
  if (state === "done")    return "border-emerald-400/40 bg-emerald-500/[0.10] text-emerald-200";
  if (state === "current") return "border-amber-400/40 bg-amber-500/[0.10] text-amber-200";
  return "border-white/[0.10] bg-white/[0.04] text-gray-400";
}

function Block({ icon, tone, title, children }: {
  icon: RrIconName; tone: "amber" | "blue" | "neutral"; title: string; children: React.ReactNode;
}) {
  const dot =
    tone === "amber" ? "text-amber-200" :
    tone === "blue"  ? "text-blue-200"  : "text-gray-300";
  return (
    <div className="mt-3 first:mt-0 border-t border-white/[0.05] pt-2 first:border-t-0 first:pt-0">
      <div className={`flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.10em] ${dot}`}>
        <RrIcon name={icon} size={9} />
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-gray-500">{children}</div>;
}
