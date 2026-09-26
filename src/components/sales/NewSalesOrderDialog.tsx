"use client";

/* ---------------------------------------------------------------------------
   NewSalesOrderDialog — create a sales order by hand.

   POST /api/sales/orders has existed since the SO → shipment → inventory OUT
   flow was built, but no screen called it: /sales/orders was list-only, and
   Smart Create's "Sales Order" tile (and the Data Entry hub's) opened that
   list. This is the missing form.

   Customer from the Customers directory, currency seeded from the
   customer's own currency, one or more lines. A line that picks a STOCK
   ITEM can be shipped later (ShipDialog moves inventory against
   inventory_item_id); a free-text line is allowed but cannot be shipped, and
   the form says so.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/kds/FormModal";
import KdsSelect from "@/components/kds/Select";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import { humanizeError } from "@/lib/ui/humanize-error";

const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1.5";
const inputCls = "w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-ghost)] focus:border-[var(--border-focus)] focus:outline-none transition-colors";
const textareaCls = `${inputCls} h-20 py-2 leading-relaxed resize-none`;
const submitBtnCls = "h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all shadow-lg disabled:opacity-50";
const cancelBtnCls = "h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors";

interface CustomerRow { id: string; name: string | null; company_name: string | null; currency_code: string | null; status: string | null }
interface ItemRow { id: string; item_name: string; sku: string | null }
interface Line { key: number; itemId: string; description: string; qty: string; unitPrice: string }

let lineSeq = 0;
const blankLine = (): Line => ({ key: ++lineSeq, itemId: "", description: "", qty: "1", unitPrice: "" });

export default function NewSalesOrderDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (order: { id: string; so_no: string }) => void;
}) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState<"draft" | "confirmed">("draft");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>(() => [blankLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fresh form + fresh pickers each time it opens, so a customer or item
     added a minute ago is there without a reload. */
  useEffect(() => {
    if (!open) return;
    setCustomerId(""); setCurrency("USD"); setStatus("draft"); setNotes("");
    setLines([blankLine()]); setError(null);
    let alive = true;
    void (async () => {
      const [c, i] = await Promise.all([
        fetch("/api/customers", { credentials: "include" }).then((r) => (r.ok ? r.json() : { customers: [] })).catch(() => ({ customers: [] })),
        fetch("/api/inventory/items?status=active&limit=500", { credentials: "include" }).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] })),
      ]);
      if (!alive) return;
      setCustomers(((c.customers ?? []) as CustomerRow[]).filter((x) => x.status !== "archived"));
      setItems((i.items ?? []) as ItemRow[]);
    })();
    return () => { alive = false; };
  }, [open]);

  const customerOptions = useMemo(
    () => customers.map((c) => ({ value: c.id, label: [c.company_name, c.name].filter(Boolean).join(" — ") || "Unnamed customer" })),
    [customers],
  );
  const itemOptions = useMemo(
    () => items.map((it) => ({ value: it.id, label: it.sku ? `${it.sku} · ${it.item_name}` : it.item_name })),
    [items],
  );

  const total = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0),
    [lines],
  );

  function pickCustomer(id: string) {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c?.currency_code) setCurrency(c.currency_code.toUpperCase());
  }

  function patchLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function pickItem(key: number, itemId: string) {
    const it = items.find((x) => x.id === itemId);
    setLines((ls) => ls.map((l) => (l.key === key
      ? { ...l, itemId, description: l.description.trim() ? l.description : (it?.item_name ?? "") }
      : l)));
  }

  async function submit() {
    setError(null);
    if (!customerId) { setError("Pick a customer."); return; }
    const filled = lines.filter((l) => l.itemId || l.description.trim());
    if (filled.length === 0) { setError("Add at least one line — a stock item or a description."); return; }
    if (filled.some((l) => !(Number(l.qty) > 0))) { setError("Every line needs a quantity above zero."); return; }
    if (!/^[A-Z]{3}$/.test(currency)) { setError("Currency is a 3-letter code, e.g. USD."); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/sales/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          currency,
          status,
          notes: notes.trim() || null,
          items: filled.map((l) => ({
            inventory_item_id: l.itemId || null,
            description: l.description.trim() || null,
            qty: Number(l.qty) || 0,
            unit_price: Number(l.unitPrice) || 0,
          })),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.order) throw new Error(j.error ?? `HTTP ${r.status}`);
      onCreated(j.order as { id: string; so_no: string });
      onClose();
    } catch (e) {
      setError(humanizeError(e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New sales order"
      subtitle="Commit to ship goods to a customer"
      width="max-w-2xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={cancelBtnCls}>Cancel</button>
          <button type="button" onClick={submit} disabled={saving} className={submitBtnCls}>
            {saving ? "Creating…" : "Create order"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px_140px]">
          <div>
            <label className={labelCls}>Customer</label>
            <KdsSelect
              value={customerId}
              onChange={pickCustomer}
              options={customerOptions}
              placeholder="— Choose customer —"
              triggerClassName={`${inputCls} pe-7 cursor-pointer text-start`}
            />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <KdsSelect
              value={status}
              onChange={(v) => setStatus(v === "confirmed" ? "confirmed" : "draft")}
              options={[{ value: "draft", label: "Draft" }, { value: "confirmed", label: "Confirmed" }]}
              triggerClassName={`${inputCls} pe-7 cursor-pointer text-start`}
            />
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Lines</p>
            <p className="text-[10.5px] text-[var(--text-dim)]">Pick a stock item for lines you will ship.</p>
          </div>
          {lines.map((l) => (
            <div key={l.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-[var(--border-subtle)] p-2 sm:grid-cols-[1.2fr_1fr_70px_100px_auto] sm:items-end sm:border-0 sm:p-0">
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Stock item</label>
                <KdsSelect
                  value={l.itemId}
                  onChange={(v) => pickItem(l.key, v)}
                  options={itemOptions}
                  placeholder="— Free-text line —"
                  triggerClassName={`${inputCls} pe-7 cursor-pointer text-start`}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Description</label>
                <input value={l.description} onChange={(e) => patchLine(l.key, { description: e.target.value })} className={inputCls} placeholder="What is sold" />
              </div>
              <div>
                <label className={labelCls}>Qty</label>
                <input type="number" min="0" value={l.qty} onChange={(e) => patchLine(l.key, { qty: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Unit price</label>
                <input type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => patchLine(l.key, { unitPrice: e.target.value })} className={inputCls} />
              </div>
              <button
                type="button"
                aria-label="Remove line"
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                className="flex h-10 w-10 items-center justify-center self-end rounded-xl text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-surface)] hover:text-rose-400 disabled:opacity-30"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, blankLine()])}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            >
              <PlusIcon className="h-3.5 w-3.5" /> Add line
            </button>
            <span className="text-[12px] text-[var(--text-dim)]">
              Total: <span className="font-semibold tabular-nums text-[var(--text-primary)]">{currency} {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </span>
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} placeholder="Delivery details, references…" />
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-400">{error}</div>
        )}
      </div>
    </Modal>
  );
}
