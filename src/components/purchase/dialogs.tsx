"use client";

/* ---------------------------------------------------------------------------
   Purchase create-dialogs.

   One file holds every "New X" modal used by the Purchase app —
   Requisition, Purchase Order, Goods Receipt, Vendor Bill, Payment.
   Each dialog is self-contained: opens a themed Modal, lets the user
   fill the header + ONE line item, writes the parent + line rows to
   Supabase, and tells the caller via `onCreated()` so the list can
   refresh.

   Why one line item per modal: the most common reason a user needs
   a "create" flow is to file a routine office-supplies buy (tissues,
   coffee, paper). That's a single-line decision. Items 2+ get added
   later from the row's detail view (planned). For multi-line POs
   you'd typically convert from a requisition or RFQ instead of
   typing items inline.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/admin/form-sections/Modal";
import { dialog } from "@/lib/ui-dialog";

/* RLS-4: every read/write in this file goes through the gated Purchase API
   (/api/purchase/list pickers + POST /api/purchase/create) instead of the
   anon Supabase client, so the purchase and vendor tables can be locked
   to service_role. */

/* ─── Form primitives ─────────────────────────────────────────────── */

const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1.5";
const inputCls = "w-full h-10 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-ghost)] focus:border-[var(--border-focus)] focus:outline-none transition-colors";
const textareaCls = `${inputCls} h-20 py-2 leading-relaxed resize-none`;
const submitBtnCls = "h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all disabled:opacity-50";
const cancelBtnCls = "h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

interface SupplierOption { id: string; label: string }
interface CategoryOption { id: string; label: string; kind: string }
interface ProductOption  { id: string; label: string }

/* ─── Numbering helper ────────────────────────────────────────────────
   Suggests the next "PREFIX-YYYY-NNNN" doc number via the gated
   nextnos resource (server computes it tenant-scoped). The create
   route re-generates on save if the field was cleared, so a race
   between two admins resolves server-side. */
type NextNoKind = "pr" | "po" | "gr" | "bill" | "pay";
async function suggestNextDocNo(kind: NextNoKind): Promise<string> {
  try {
    const res = await fetch("/api/purchase/list?resource=nextnos", { credentials: "include" });
    if (!res.ok) return "";
    const j = (await res.json()) as Record<NextNoKind, string>;
    return j[kind] ?? "";
  } catch { return ""; }
}

/** Shared list-resource fetch for the picker hooks below. */
async function fetchListRows<T>(resource: string): Promise<T[]> {
  try {
    const res = await fetch(`/api/purchase/list?resource=${resource}`, { credentials: "include" });
    if (!res.ok) return [];
    const j = (await res.json()) as { rows?: T[] };
    return Array.isArray(j.rows) ? j.rows : [];
  } catch { return []; }
}

/* Hooks for the option lists used across multiple dialogs. Each
   refetches when its dialog opens so newly added suppliers /
   categories appear without a page reload. */
function useSuppliers(open: boolean): SupplierOption[] {
  const [list, setList] = useState<SupplierOption[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const rows = await fetchListRows<{ id: string; display_name: string | null; company_name: string | null; full_name: string | null }>("supplier_options");
      if (cancelled) return;
      const opts = rows.map((c) => ({
        id: c.id,
        label: c.company_name || c.full_name || c.display_name || "(unnamed)",
      }));
      opts.sort((a, b) => a.label.localeCompare(b.label));
      setList(opts);
    })();
    return () => { cancelled = true; };
  }, [open]);
  return list;
}

function useCategories(open: boolean): CategoryOption[] {
  const [list, setList] = useState<CategoryOption[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const rows = await fetchListRows<{ id: string; code: string | null; name: string; kind: string }>("categories");
      if (cancelled) return;
      setList(rows.map((c) => ({
        id: c.id,
        label: c.code ? `${c.code} · ${c.name}` : c.name,
        kind: c.kind,
      })));
    })();
    return () => { cancelled = true; };
  }, [open]);
  return list;
}

/** POST to the gated create route. Returns null on success, or an error
 *  message the dialog should show. */
async function createPurchaseDoc(
  kind: "requisition" | "order" | "receipt" | "bill" | "payment",
  doc: Record<string, unknown>,
  item?: Record<string, unknown> | null,
): Promise<string | null> {
  try {
    const res = await fetch("/api/purchase/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, doc, item: item ?? null }),
    });
    if (res.ok) return null;
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return j.error || `Save failed (${res.status})`;
  } catch (e) {
    return e instanceof Error ? e.message : "Network error";
  }
}

function useProducts(open: boolean): ProductOption[] {
  const [list, setList] = useState<ProductOption[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      /* P0-B: products read goes through /api/products (auth + projection)
         instead of the anon client. */
      let rows: { id: string; product_name: string }[] = [];
      try {
        const res = await fetch("/api/products", { credentials: "include" });
        if (res.ok) {
          const json = (await res.json()) as { products?: { id: string; product_name: string }[] };
          rows = (json.products ?? [])
            .slice()
            .sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""));
        }
      } catch { /* leave empty on failure */ }
      if (cancelled) return;
      setList(rows.map((p) => ({ id: p.id, label: p.product_name })));
    })();
    return () => { cancelled = true; };
  }, [open]);
  return list;
}

/* Reusable footer action buttons shared by every dialog. */
function DialogFooter({ onCancel, onSubmit, submitLabel, saving }: {
  onCancel: () => void; onSubmit: () => void; submitLabel: string; saving: boolean;
}) {
  return (
    <>
      <button type="button" onClick={onCancel} className={cancelBtnCls}>Cancel</button>
      <button type="button" onClick={onSubmit} disabled={saving} className={submitBtnCls}>
        {saving ? "Saving…" : submitLabel}
      </button>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   1. New Requisition
   ════════════════════════════════════════════════════════════════════ */

export function NewRequisitionDialog({ open, onClose, onCreated }: DialogProps) {
  const categories = useCategories(open);
  const products   = useProducts(open);

  const [prNo, setPrNo] = useState("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("1");
  const [neededBy, setNeededBy] = useState("");
  const [justification, setJustification] = useState("");
  const [currency, setCurrency] = useState("USD");

  /* Requesting department is an INTERNAL company department — picked from the
     company's department list, not free text (QA issue 6244c4c1). */
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!open) return;
    fetch("/api/management/departments", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { departments: [] }))
      .then((j) => setDepartments(Array.isArray(j.departments) ? j.departments : []))
      .catch(() => setDepartments([]));
  }, [open]);

  const [productId, setProductId] = useState("");      // optional
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pc");
  const [estimatedPrice, setEstimatedPrice] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    suggestNextDocNo("pr").then(setPrNo);
    setDepartment(""); setPriority("1"); setNeededBy(""); setJustification(""); setCurrency("USD");
    setProductId(""); setDescription(""); setCategoryId(""); setQty("1"); setUnit("pc"); setEstimatedPrice("");
  }, [open]);

  const totalEstimated = useMemo(() => {
    const q = Number(qty) || 0;
    const p = Number(estimatedPrice) || 0;
    return q * p;
  }, [qty, estimatedPrice]);

  const submit = async () => {
    if (!description.trim()) {
      await dialog.alert({ title: "Missing item", message: "Add a description for what you need (e.g. \"Office tissues — 50 boxes\")." });
      return;
    }
    setSaving(true);

    const err = await createPurchaseDoc("requisition", {
      pr_no: prNo,
      department,
      priority: Number(priority) || 1,
      needed_by: neededBy,
      justification,
      currency,
      total_estimated: totalEstimated,
    }, {
      product_id: productId,
      description,
      category_id: categoryId,
      qty: Number(qty) || 0,
      unit,
      estimated_price: Number(estimatedPrice) || 0,
    });

    setSaving(false);
    if (err) {
      await dialog.alert({ title: "Couldn't create requisition", message: err });
      return;
    }
    onCreated?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New requisition" subtitle="File a request to buy something for the team" width="max-w-xl"
      footer={<DialogFooter onCancel={onClose} onSubmit={submit} submitLabel="File requisition" saving={saving} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>PR number</label>
            <input value={prNo} onChange={(e) => setPrNo(e.target.value)} className={inputCls} placeholder="PR-2026-0001" />
          </div>
          <div>
            <label className={labelCls}>Requesting department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls}>
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              <option value="0">Low</option>
              <option value="1">Normal</option>
              <option value="2">High</option>
              <option value="3">Urgent</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Needed by</label>
            {/* Future event — can't be needed in the past (QA issue 8f009186). */}
            <input type="date" min={new Date().toISOString().slice(0, 10)} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Justification</label>
          <textarea value={justification} onChange={(e) => setJustification(e.target.value)} className={textareaCls} placeholder="Why do we need this? (optional)" />
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-[var(--bg-surface-subtle)]/40 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Item</p>
          <div>
            <label className={labelCls}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder='e.g. "Office tissues — 50 boxes"' />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">— Choose category —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Catalog product (optional)</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
                <option value="">— Free-text item —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Qty</label>
              <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} placeholder="pc / box / kg" />
            </div>
            <div>
              <label className={labelCls}>Est. price each</label>
              <input type="number" step="0.01" min="0" value={estimatedPrice} onChange={(e) => setEstimatedPrice(e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
          </div>
          <div className="text-right text-[12px] text-[var(--text-dim)]">
            Total est: <span className="font-semibold tabular-nums text-[var(--text-primary)]">{currency} {totalEstimated.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════
   2. New Purchase Order
   ════════════════════════════════════════════════════════════════════ */

export function NewPurchaseOrderDialog({ open, onClose, onCreated }: DialogProps) {
  const suppliers  = useSuppliers(open);
  const categories = useCategories(open);
  const products   = useProducts(open);

  const [poNo, setPoNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [incoterms, setIncoterms] = useState("");
  const [shipTo, setShipTo] = useState("");
  const [notes, setNotes] = useState("");

  const [productId, setProductId] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pc");
  const [unitCost, setUnitCost] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    suggestNextDocNo("po").then(setPoNo);
    setSupplierId(""); setOrderDate(new Date().toISOString().slice(0, 10));
    setExpectedDelivery(""); setCurrency("USD"); setPaymentTerms("Net 30"); setIncoterms("");
    setShipTo(""); setNotes("");
    setProductId(""); setDescription(""); setCategoryId(""); setQty("1"); setUnit("pc"); setUnitCost("");
  }, [open]);

  const lineTotal = useMemo(() => (Number(qty) || 0) * (Number(unitCost) || 0), [qty, unitCost]);

  const submit = async () => {
    if (!supplierId) {
      await dialog.alert({ title: "Pick a supplier", message: "Every PO needs a supplier. Add one in Contacts if it's missing." });
      return;
    }
    if (!description.trim()) {
      await dialog.alert({ title: "Missing item", message: "Describe what you're buying." });
      return;
    }
    setSaving(true);

    const err = await createPurchaseDoc("order", {
      po_no: poNo,
      supplier_id: supplierId,
      order_date: orderDate,
      expected_delivery_date: expectedDelivery,
      currency,
      payment_terms: paymentTerms,
      incoterms,
      ship_to_address: shipTo,
      category_id: categoryId,
      notes,
    }, {
      product_id: productId,
      description,
      category_id: categoryId,
      qty: Number(qty) || 0,
      unit,
      unit_cost: Number(unitCost) || 0,
    });

    setSaving(false);
    if (err) {
      await dialog.alert({ title: "Couldn't create PO", message: err });
      return;
    }
    onCreated?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New purchase order" subtitle="Confirm a buy with a supplier" width="max-w-xl"
      footer={<DialogFooter onCancel={onClose} onSubmit={submit} submitLabel="Create PO" saving={saving} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>PO number</label>
            <input value={poNo} onChange={(e) => setPoNo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Supplier</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Choose supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Order date</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Expected delivery</label>
            {/* Delivery is in the future — never before the order date (QA issue 8f009186). */}
            <input type="date" min={orderDate || new Date().toISOString().slice(0, 10)} value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputCls} maxLength={3} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Payment terms</label>
            <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls} placeholder="Net 30" />
          </div>
          <div>
            <label className={labelCls}>Incoterms</label>
            <input value={incoterms} onChange={(e) => setIncoterms(e.target.value)} className={inputCls} placeholder="FOB / EXW / DDP …" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Ship to</label>
          <textarea value={shipTo} onChange={(e) => setShipTo(e.target.value)} className={textareaCls} placeholder="Delivery address" />
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-[var(--bg-surface-subtle)]/40 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Item</p>
          <div>
            <label className={labelCls}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder='e.g. "Coffee beans 1kg — bag"' />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">— Optional —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Catalog product (optional)</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
                <option value="">— Free-text item —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Qty</label>
              <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} placeholder="pc / kg / box" />
            </div>
            <div>
              <label className={labelCls}>Unit cost</label>
              <input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="text-right text-[12px] text-[var(--text-dim)]">
            Line total: <span className="font-semibold tabular-nums text-[var(--text-primary)]">{currency} {lineTotal.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} placeholder="Anything the supplier should know" />
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════
   3. New Goods Receipt
   ════════════════════════════════════════════════════════════════════ */

interface POOption { id: string; label: string; supplier_id: string | null }

export function NewReceiptDialog({ open, onClose, onCreated }: DialogProps) {
  const suppliers = useSuppliers(open);
  const [poList, setPoList] = useState<POOption[]>([]);

  const [grNo, setGrNo] = useState("");
  const [poId, setPoId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [notes, setNotes] = useState("");
  const [statusValue, setStatusValue] = useState("complete");

  const [qtyReceived, setQtyReceived] = useState("");
  const [qtyAccepted, setQtyAccepted] = useState("");
  const [qtyRejected, setQtyRejected] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    suggestNextDocNo("gr").then(setGrNo);
    setPoId(""); setSupplierId(""); setReceivedAt(new Date().toISOString().slice(0, 10));
    setCarrier(""); setTrackingNo(""); setNotes(""); setStatusValue("complete");
    setQtyReceived(""); setQtyAccepted(""); setQtyRejected("");

    (async () => {
      const rows = await fetchListRows<{ id: string; po_no: string | null; supplier_id: string | null }>("orders");
      setPoList(rows.map((p) => ({
        id: p.id, label: p.po_no || p.id.slice(0, 8), supplier_id: p.supplier_id,
      })));
    })();
  }, [open]);

  /* When a PO is picked, default the supplier to the PO's supplier
     so the user doesn't have to repeat the choice. */
  useEffect(() => {
    if (!poId) return;
    const po = poList.find((p) => p.id === poId);
    if (po?.supplier_id) setSupplierId(po.supplier_id);
  }, [poId, poList]);

  const submit = async () => {
    if (!supplierId && !poId) {
      await dialog.alert({ title: "Link the receipt", message: "Pick the PO this receipt is against, or at least the supplier." });
      return;
    }
    setSaving(true);

    const err = await createPurchaseDoc("receipt", {
      gr_no: grNo,
      po_id: poId,
      supplier_id: supplierId,
      received_at: receivedAt,
      carrier,
      tracking_no: trackingNo,
      notes,
      status: statusValue,
    }, {
      qty_received: Number(qtyReceived) || 0,
      qty_accepted: Number(qtyAccepted || qtyReceived) || 0,
      qty_rejected: Number(qtyRejected) || 0,
    });

    setSaving(false);
    if (err) {
      await dialog.alert({ title: "Couldn't create receipt", message: err });
      return;
    }
    onCreated?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Record goods receipt" subtitle="Log what physically arrived" width="max-w-xl"
      footer={<DialogFooter onCancel={onClose} onSubmit={submit} submitLabel="Save receipt" saving={saving} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>GR number</label>
            <input value={grNo} onChange={(e) => setGrNo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={statusValue} onChange={(e) => setStatusValue(e.target.value)} className={inputCls}>
              <option value="complete">Complete</option>
              <option value="partial">Partial</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Linked PO</label>
            <select value={poId} onChange={(e) => setPoId(e.target.value)} className={inputCls}>
              <option value="">— None / direct —</option>
              {poList.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Supplier</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Choose supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Received at</label>
            <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Carrier</label>
            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls} placeholder="DHL / UPS / local" />
          </div>
          <div>
            <label className={labelCls}>Tracking #</label>
            <input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Qty received</label>
            <input type="number" min="0" value={qtyReceived} onChange={(e) => setQtyReceived(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Qty accepted</label>
            <input type="number" min="0" value={qtyAccepted} onChange={(e) => setQtyAccepted(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Qty rejected</label>
            <input type="number" min="0" value={qtyRejected} onChange={(e) => setQtyRejected(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} placeholder="Condition, damage, missing items …" />
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════
   4. New Vendor Bill
   ════════════════════════════════════════════════════════════════════ */

export function NewBillDialog({ open, onClose, onCreated }: DialogProps) {
  const suppliers  = useSuppliers(open);
  const categories = useCategories(open);
  const [poList, setPoList] = useState<POOption[]>([]);

  const [billNo, setBillNo] = useState("");
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [poId, setPoId] = useState("");
  const [billDate, setBillDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");

  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pc");
  const [unitPrice, setUnitPrice] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    suggestNextDocNo("bill").then(setBillNo);
    setSupplierInvoiceNo(""); setSupplierId(""); setPoId("");
    setBillDate(new Date().toISOString().slice(0, 10));
    const due = new Date(); due.setDate(due.getDate() + 30);
    setDueDate(due.toISOString().slice(0, 10));
    setCurrency("USD"); setPaymentTerms("Net 30");
    setDescription(""); setCategoryId(""); setQty("1"); setUnit("pc"); setUnitPrice("");

    (async () => {
      const rows = await fetchListRows<{ id: string; po_no: string | null; supplier_id: string | null }>("orders");
      setPoList(rows.map((p) => ({
        id: p.id, label: p.po_no || p.id.slice(0, 8), supplier_id: p.supplier_id,
      })));
    })();
  }, [open]);

  useEffect(() => {
    if (!poId) return;
    const po = poList.find((p) => p.id === poId);
    if (po?.supplier_id) setSupplierId(po.supplier_id);
  }, [poId, poList]);

  const lineTotal = useMemo(() => (Number(qty) || 0) * (Number(unitPrice) || 0), [qty, unitPrice]);

  const submit = async () => {
    if (!supplierId) {
      await dialog.alert({ title: "Pick a supplier", message: "Every bill is from one supplier." });
      return;
    }
    if (!description.trim()) {
      await dialog.alert({ title: "Missing line", message: "Describe what the bill is for." });
      return;
    }
    setSaving(true);

    const err = await createPurchaseDoc("bill", {
      bill_no: billNo,
      supplier_invoice_no: supplierInvoiceNo,
      supplier_id: supplierId,
      po_id: poId,
      bill_date: billDate,
      due_date: dueDate,
      currency,
      payment_terms: paymentTerms,
    }, {
      description,
      category_id: categoryId,
      qty: Number(qty) || 0,
      unit,
      unit_price: Number(unitPrice) || 0,
    });

    setSaving(false);
    if (err) {
      await dialog.alert({ title: "Couldn't post bill", message: err });
      return;
    }
    onCreated?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="New vendor bill" subtitle="Log a supplier's invoice to us" width="max-w-xl"
      footer={<DialogFooter onCancel={onClose} onSubmit={submit} submitLabel="Post bill" saving={saving} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Bill number (ours)</label>
            <input value={billNo} onChange={(e) => setBillNo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Supplier invoice #</label>
            <input value={supplierInvoiceNo} onChange={(e) => setSupplierInvoiceNo(e.target.value)} className={inputCls} placeholder="From the document" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Supplier</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Choose supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Linked PO</label>
            <select value={poId} onChange={(e) => setPoId(e.target.value)} className={inputCls}>
              <option value="">— None / direct —</option>
              {poList.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Bill date</label>
            <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputCls} maxLength={3} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Payment terms</label>
          <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls} />
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-[var(--bg-surface-subtle)]/40 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">Line</p>
          <div>
            <label className={labelCls}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder='e.g. "Office supplies — Apr 2026"' />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">— Optional —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Qty</label>
              <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unit price</label>
              <input type="number" step="0.01" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Line total</label>
              <input value={`${currency} ${lineTotal.toFixed(2)}`} readOnly className={`${inputCls} text-[var(--text-muted)] bg-[var(--bg-surface-subtle)]`} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ════════════════════════════════════════════════════════════════════
   5. New Vendor Payment
   ════════════════════════════════════════════════════════════════════ */

interface BillOption { id: string; label: string; supplier_id: string | null; balance: number | null; total: number | null }

export function NewPaymentDialog({ open, onClose, onCreated }: DialogProps) {
  const suppliers = useSuppliers(open);
  const [bills, setBills] = useState<BillOption[]>([]);

  const [paymentNo, setPaymentNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [billId, setBillId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    suggestNextDocNo("pay").then(setPaymentNo);
    setSupplierId(""); setBillId(""); setAmount(""); setCurrency("USD"); setMethod("bank_transfer");
    setReference(""); setPaidAt(new Date().toISOString().slice(0, 10)); setNotes("");

    (async () => {
      const rows = await fetchListRows<{ id: string; bill_no: string | null; supplier_id: string | null; balance: number | null; total: number | null; status: string | null }>("bills");
      setBills(rows.filter((b) => b.status !== "paid").map((b) => ({
        id: b.id, label: b.bill_no || b.id.slice(0, 8), supplier_id: b.supplier_id,
        balance: b.balance ?? b.total,
        total: b.total ?? b.balance,
      })));
    })();
  }, [open]);

  useEffect(() => {
    if (!billId) return;
    const b = bills.find((x) => x.id === billId);
    if (!b) return;
    if (b.supplier_id) setSupplierId(b.supplier_id);
    if (b.balance != null && !amount) setAmount(String(b.balance));
  }, [billId, bills, amount]);

  const submit = async () => {
    if (!supplierId) {
      await dialog.alert({ title: "Pick a supplier", message: "Choose who the payment goes to." });
      return;
    }
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      await dialog.alert({ title: "Amount required", message: "Enter the amount paid." });
      return;
    }
    setSaving(true);

    /* Bill settlement (balance/amount_paid/status) happens SERVER-side in
       the create route from the DB's own figures — no client-computed
       balances cross the wire anymore. */
    const err = await createPurchaseDoc("payment", {
      payment_no: paymentNo,
      bill_id: billId,
      supplier_id: supplierId,
      amount: amt,
      currency,
      method,
      reference,
      paid_at: paidAt,
      notes,
    });

    setSaving(false);
    if (err) {
      await dialog.alert({ title: "Couldn't record payment", message: err });
      return;
    }
    onCreated?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Record payment" subtitle="Money going out to a supplier" width="max-w-xl"
      footer={<DialogFooter onCancel={onClose} onSubmit={submit} submitLabel="Save payment" saving={saving} />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Payment #</label>
            <input value={paymentNo} onChange={(e) => setPaymentNo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Paid at</label>
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Bill (optional)</label>
            <select value={billId} onChange={(e) => setBillId(e.target.value)} className={inputCls}>
              <option value="">— None / on-account —</option>
              {bills.map((b) => <option key={b.id} value={b.id}>{b.label}{b.balance != null ? ` · open ${b.balance}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Supplier</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
              <option value="">— Choose supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Amount</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputCls} maxLength={3} />
          </div>
          <div>
            <label className={labelCls}>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="wire">Wire</option>
              <option value="check">Check</option>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Reference</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} placeholder="Bank ref / check no" />
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={textareaCls} placeholder="Anything to remember about this payment" />
        </div>
      </div>
    </Modal>
  );
}
