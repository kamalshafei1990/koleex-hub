"use client";

/* ---------------------------------------------------------------------------
   Raise a purchase order for a deal.

   The goods are already known — they are what the customer's invoice says was
   sold — so the dialog starts from them and asks for the two things nobody
   can derive: WHO supplies them, and WHAT each one costs.

   ── Why cost starts empty ──────────────────────────────────────────────────
   Prefilling the sale price as the purchase cost would silently produce a
   zero-margin PO that looks filled in. A blank is honest: it is the number
   the buyer is here to decide.

   ── Why lines can be dropped ───────────────────────────────────────────────
   One deal is rarely sourced from one supplier. The buyer keeps the lines this
   supplier provides and raises another PO for the rest, each one linked to the
   same deal.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";

/* A supplier is a CONTACT with contact_type 'supplier' — that is what
   purchase_orders.supplier_id points at. */
interface SupplierRef {
  id: string;
  display_name: string | null;
  company_name: string | null;
  full_name: string | null;
}

interface SuggestedItem {
  description: string;
  model: string;
  qty: number;
  unit: string;
  unit_cost: number;
  sort_order: number;
}

interface Prefill {
  fromInvoice: string | null;
  suggestedItems: SuggestedItem[];
  suppliers: SupplierRef[];
}

const INPUT =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--border-strong)]";

export default function RaisePurchaseOrderDialog({
  orderId,
  orderNo,
  onClose,
  onCreated,
}: {
  orderId: string;
  orderNo: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<SuggestedItem[]>([]);
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}/purchase-orders`, { cache: "no-store" });
        const json = (await res.json()) as Partial<Prefill> & { error?: string };
        if (!alive) return;
        if (!res.ok) throw new Error(json.error ?? "Could not load the deal's goods.");
        setPrefill({
          fromInvoice: json.fromInvoice ?? null,
          suggestedItems: json.suggestedItems ?? [],
          suppliers: json.suppliers ?? [],
        });
        setLines(json.suggestedItems ?? []);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load the deal's goods.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0),
    [lines],
  );

  const setLine = useCallback((i: number, patch: Partial<SuggestedItem>) => {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }, []);

  const submit = useCallback(async () => {
    if (!supplierId || lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          order_id: orderId,
          expected_delivery_date: expected || null,
          status: "draft",
          notes: `Sourcing ${orderNo}`,
          items: lines.map((l, i) => ({
            description: l.model ? `${l.model} — ${l.description}` : l.description,
            qty: Number(l.qty) || 0,
            unit: l.unit || "pc",
            unit_cost: Number(l.unit_cost) || 0,
            sort_order: i,
          })),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not raise the purchase order.");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not raise the purchase order.");
      setBusy(false);
    }
  }, [supplierId, lines, orderId, orderNo, expected, onCreated]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="kx-pop-clear flex flex-col"
        style={{
          maxWidth: 720,
          width: "100%",
          maxHeight: "86vh",
          borderRadius: 16,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Raise a purchase order</h2>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              Sourcing <span className="font-mono">{orderNo}</span>
              {prefill?.fromInvoice ? (
                <>
                  {" "}
                  · goods from <span className="font-mono">{prefill.fromInvoice}</span>
                </>
              ) : null}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
            aria-label="Close"
          >
            <CrossIcon size={14} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
          {!prefill && !error ? (
            <div className="flex items-center justify-center py-12 text-[var(--text-secondary)]">
              <SpinnerIcon size={24} />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 mb-5">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">Supplier</label>
                  <select className={INPUT} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                    <option value="">— choose —</option>
                    {(prefill?.suppliers ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.company_name || s.display_name || s.full_name || s.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">
                    Expected delivery
                  </label>
                  <input type="date" className={INPUT} value={expected} onChange={(e) => setExpected(e.target.value)} />
                </div>
              </div>

              {lines.length === 0 ? (
                <p className="text-[13px] text-[var(--text-secondary)] py-6 text-center">
                  This deal has no invoice yet, so there are no goods to source from. Raise the invoice first, or add
                  lines in the Purchases app.
                </p>
              ) : (
                <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                  <div className="grid grid-cols-[1fr_64px_92px_92px_28px] gap-2 px-3 py-2 bg-[var(--bg-surface)] text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-faint)]">
                    <span>Item</span>
                    <span className="text-end">Qty</span>
                    <span className="text-end">Unit cost</span>
                    <span className="text-end">Line</span>
                    <span />
                  </div>
                  {lines.map((l, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_64px_92px_92px_28px] gap-2 px-3 py-2 items-center border-t border-[var(--border-subtle)]"
                    >
                      <div className="min-w-0">
                        {l.model ? (
                          <div className="font-mono text-[11px] text-[var(--text-secondary)]">{l.model}</div>
                        ) : null}
                        <div className="text-[12.5px] text-[var(--text-primary)] truncate" title={l.description}>
                          {l.description || "—"}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={l.qty}
                        onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                        className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[12px] text-end tabular-nums text-[var(--text-primary)] outline-none"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        value={l.unit_cost || ""}
                        onChange={(e) => setLine(i, { unit_cost: Number(e.target.value) })}
                        className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[12px] text-end tabular-nums text-[var(--text-primary)] outline-none"
                      />
                      <span className="text-[12px] text-end tabular-nums text-[var(--text-primary)]">
                        {((Number(l.qty) || 0) * (Number(l.unit_cost) || 0)).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <button
                        onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                        className="p-1 rounded text-[var(--text-faint)] hover:text-rose-400 transition"
                        title="Remove — another supplier provides this one"
                        aria-label="Remove line"
                      >
                        <CrossIcon size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error ? <p className="mt-3 text-[12.5px] text-rose-400">{error}</p> : null}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border-subtle)]">
          <span className="text-[12px] text-[var(--text-secondary)]">
            {lines.length} line{lines.length === 1 ? "" : "s"} ·{" "}
            <span className="font-semibold tabular-nums text-[var(--text-primary)]">
              {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={!supplierId || lines.length === 0 || busy}>
              {busy ? "Raising…" : "Raise draft PO"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
