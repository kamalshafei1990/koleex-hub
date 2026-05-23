"use client";

/* ---------------------------------------------------------------------------
   New-Return drawer. Used on /inventory/returns.

   Steps the user through:
     1. Pick return type (customer / supplier)
     2. Pick party (customer or supplier)
     3. Optional source document type + id
     4. Pick warehouse + reason code
     5. Item lines: product, qty, condition, disposition
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RrIcon from "@/components/ui/RrIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";

type ReturnType = "customer_return" | "supplier_return";

type ReasonCode =
  | "damaged" | "defective" | "wrong_item" | "excess" | "warranty"
  | "expired" | "customer_rejection" | "supplier_error" | "other";

type ConditionStatus = "good" | "damaged" | "defective" | "scrap";

type Disposition = "restock" | "quarantine" | "scrap" | "vendor_return";

interface Warehouse { id: string; code: string; name: string; is_default: boolean; kind?: string | null }
interface ContactRow {
  id: string;
  display_name: string | null;
  company_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface ProductOption {
  product_id: string;
  product_name: string;
  brand: string | null;
  sku: string | null;
  model_name: string | null;
  stock_profile: {
    inventory_item_id: string;
    item_code: string;
    unit_of_measure: string;
  } | null;
}

interface LineDraft {
  key: string;
  inventory_item_id: string;
  product_label: string;
  quantity: string;
  unit_of_measure: string;
  condition_status: ConditionStatus;
  disposition: Disposition;
}

const REASONS: ReasonCode[] = [
  "damaged", "defective", "wrong_item", "excess", "warranty",
  "expired", "customer_rejection", "supplier_error", "other",
];

const CONDITIONS: ConditionStatus[] = ["good", "damaged", "defective", "scrap"];
const DISPOSITIONS: Disposition[] = ["restock", "quarantine", "scrap", "vendor_return"];

function contactLabel(c: ContactRow): string {
  return (
    c.display_name ||
    c.company_name ||
    c.full_name ||
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    "—"
  );
}

export default function InventoryReturnCreateDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation(inventoryT);

  const [returnType, setReturnType] = useState<ReturnType>("customer_return");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<ContactRow[]>([]);
  const [suppliers, setSuppliers] = useState<ContactRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [partyId, setPartyId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [reasonCode, setReasonCode] = useState<ReasonCode>("damaged");
  const [reasonNotes, setReasonNotes] = useState("");
  const [sourceDocType, setSourceDocType] = useState("");
  const [sourceDocId, setSourceDocId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /* Restrict picker to non-special, non-virtual warehouses where stock
     actually sits. Special warehouses (Q/SCRAP) are filtered out. */
  const standardWarehouses = useMemo(
    () => warehouses.filter((w) => (w.kind ?? "standard") === "standard"),
    [warehouses],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [whRes, cRes, sRes, prodRes] = await Promise.all([
          fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
          fetch("/api/contacts?type=customer", { cache: "no-store", credentials: "include" }),
          fetch("/api/contacts?type=supplier", { cache: "no-store", credentials: "include" }),
          fetch("/api/products/with-stock-profile?limit=500", { cache: "no-store", credentials: "include" }),
        ]);
        const whJ = await whRes.json();
        const cJ = await cRes.json();
        const sJ = await sRes.json();
        const prodJ = await prodRes.json();
        if (cancelled) return;
        const ws = (whJ.warehouses ?? []) as Warehouse[];
        setWarehouses(ws);
        const def = ws.find((w) => w.is_default) ?? ws.find((w) => (w.kind ?? "standard") === "standard");
        if (def) setWarehouseId(def.id);
        setCustomers((cJ.contacts ?? []) as ContactRow[]);
        setSuppliers((sJ.contacts ?? []) as ContactRow[]);
        setProducts(((prodJ.products ?? []) as ProductOption[]).filter((p) => p.stock_profile));
      } catch (e) {
        setError(humanizeError(e instanceof Error ? e.message : String(e)));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* When return type flips, reset the party id (customer vs supplier
     directories are disjoint). */
  useEffect(() => { setPartyId(""); }, [returnType]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: Math.random().toString(36).slice(2),
        inventory_item_id: "",
        product_label: "",
        quantity: "",
        unit_of_measure: "pcs",
        condition_status: "good",
        disposition: returnType === "customer_return" ? "restock" : "vendor_return",
      },
    ]);
  };

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const onPickProduct = (key: string, value: string) => {
    const match = products.find(
      (p) =>
        [p.product_name, p.brand, p.sku, p.model_name].filter(Boolean).join(" · ") === value,
    );
    updateLine(key, {
      product_label: value,
      inventory_item_id: match?.stock_profile?.inventory_item_id ?? "",
      unit_of_measure: match?.stock_profile?.unit_of_measure ?? "pcs",
    });
  };

  const submit = async () => {
    setError(null);
    if (!partyId) {
      setError(t("inv.returns.form.need_party"));
      return;
    }
    if (!warehouseId) {
      setError(t("inv.returns.form.need_warehouse"));
      return;
    }
    if (!reasonCode) {
      setError(t("inv.returns.form.need_reason"));
      return;
    }
    if (lines.length === 0) {
      setError(t("inv.returns.form.need_items"));
      return;
    }
    const items = lines.map((l) => ({
      inventory_item_id: l.inventory_item_id,
      quantity: Number(l.quantity),
      unit_of_measure: l.unit_of_measure,
      condition_status: l.condition_status,
      disposition: l.disposition,
    }));
    for (const it of items) {
      if (!it.inventory_item_id || !Number.isFinite(it.quantity) || it.quantity <= 0) {
        setError(t("inv.returns.form.need_items"));
        return;
      }
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/inventory/returns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          return_type: returnType,
          customer_id: returnType === "customer_return" ? partyId : null,
          supplier_id: returnType === "supplier_return" ? partyId : null,
          warehouse_id: warehouseId,
          reason_code: reasonCode,
          reason_notes: reasonNotes || null,
          source_document_type: sourceDocType || null,
          source_document_id: sourceDocId || null,
          notes: notes || null,
          items,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(humanizeError(j.error ?? `HTTP ${r.status}`));
        return;
      }
      onCreated();
      if (j.return?.id) router.push(`/inventory/returns/${j.return.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const partyList = returnType === "customer_return" ? customers : suppliers;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 bg-black/40"
        aria-label="Close"
      />
      <div className="w-full max-w-2xl overflow-y-auto border-l border-[var(--border-color)] bg-[var(--bg-primary)] p-5 text-[var(--text-primary)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.returns.title")}
            </div>
            <div className="mt-0.5 text-[15px] font-medium">{t("inv.returns.new")}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-color)] px-2 py-1 text-[11px] hover:bg-[var(--bg-surface)]"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-300 dark:text-rose-200">
            {error}
          </div>
        )}

        {/* Type segmented control */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <TypePill
            active={returnType === "customer_return"}
            onClick={() => setReturnType("customer_return")}
          >
            {t("inv.returns.type.customer")}
          </TypePill>
          <TypePill
            active={returnType === "supplier_return"}
            onClick={() => setReturnType("supplier_return")}
          >
            {t("inv.returns.type.supplier")}
          </TypePill>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {returnType === "customer_return"
                ? t("inv.returns.form.party_customer")
                : t("inv.returns.form.party_supplier")}
            </div>
            <select
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              <option value="">—</option>
              {partyList.map((c) => (
                <option key={c.id} value={c.id}>{contactLabel(c)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.returns.form.warehouse")}
            </div>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              <option value="">—</option>
              {standardWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.returns.form.reason")}
            </div>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value as ReasonCode)}
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>{t(`inv.returns.reason.${r}`)}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.returns.form.reason_notes")}
            </div>
            <input
              value={reasonNotes}
              onChange={(e) => setReasonNotes(e.target.value)}
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.returns.form.source_doc_type")}
            </div>
            <select
              value={sourceDocType}
              onChange={(e) => setSourceDocType(e.target.value)}
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              <option value="">—</option>
              <option value="sales_shipment">sales_shipment</option>
              <option value="invoice">invoice</option>
              <option value="purchase_receipt">purchase_receipt</option>
              <option value="vendor_bill">vendor_bill</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.returns.form.source_doc_id")}
            </div>
            <input
              value={sourceDocId}
              onChange={(e) => setSourceDocId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] font-mono"
              placeholder="UUID (optional)"
            />
          </label>
        </div>

        <label className="mt-3 block">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
            {t("inv.returns.form.notes")}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
          />
        </label>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.returns.detail.items")}
            </div>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] hover:bg-[var(--bg-elevated)]"
            >
              <RrIcon name="plus" size={10} />
              {t("inv.returns.form.add_item")}
            </button>
          </div>

          <datalist id="return-product-options">
            {products.map((p) => (
              <option
                key={p.product_id}
                value={[p.product_name, p.brand, p.sku, p.model_name].filter(Boolean).join(" · ")}
              />
            ))}
          </datalist>

          <div className="space-y-2">
            {lines.length === 0 && (
              <div className="rounded-md border border-dashed border-[var(--border-color)] px-3 py-3 text-center text-[11px] text-[var(--text-dim)]">
                {t("inv.returns.form.need_items")}
              </div>
            )}
            {lines.map((l) => (
              <div
                key={l.key}
                className="grid grid-cols-12 gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)]/40 p-2"
              >
                <input
                  list="return-product-options"
                  value={l.product_label}
                  onChange={(e) => onPickProduct(l.key, e.target.value)}
                  placeholder={t("inv.returns.form.item")}
                  className="col-span-4 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-[11.5px]"
                />
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={l.quantity}
                  onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                  placeholder={t("inv.returns.form.qty")}
                  className="col-span-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-right text-[11.5px] tabular-nums"
                />
                <input
                  value={l.unit_of_measure}
                  onChange={(e) => updateLine(l.key, { unit_of_measure: e.target.value })}
                  placeholder={t("inv.returns.form.unit")}
                  className="col-span-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-[11.5px]"
                />
                <select
                  value={l.condition_status}
                  onChange={(e) => updateLine(l.key, { condition_status: e.target.value as ConditionStatus })}
                  className="col-span-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-1.5 py-1 text-[11.5px]"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{t(`inv.returns.condition.${c}`)}</option>
                  ))}
                </select>
                <select
                  value={l.disposition}
                  onChange={(e) => updateLine(l.key, { disposition: e.target.value as Disposition })}
                  className="col-span-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-1.5 py-1 text-[11.5px]"
                >
                  {DISPOSITIONS.map((d) => (
                    <option key={d} value={d}>{t(`inv.returns.disp.${d}`)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  className="col-span-1 rounded-md border border-[var(--border-color)] px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-rose-400"
                  title={t("inv.returns.form.remove")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-surface)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
          >
            <RrIcon name="check" size={12} />
            {submitting ? "…" : t("inv.returns.form.save_draft")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-[12px] transition-colors ${
        active
          ? "border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
          : "border-[var(--border-color)] bg-transparent text-[var(--text-dim)] hover:bg-[var(--bg-surface)]"
      }`}
    >
      {children}
    </button>
  );
}
