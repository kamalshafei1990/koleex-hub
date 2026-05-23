"use client";

/* ---------------------------------------------------------------------------
   New-Transfer drawer. Used on /inventory/transfers.

   Picks source + destination warehouses and an arbitrary set of items
   (inventory items with stock profiles). POSTs to the transfers API
   as a draft.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RrIcon from "@/components/ui/RrIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";

interface Warehouse {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
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
}

export default function InventoryTransferCreateDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation(inventoryT);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [whRes, prodRes] = await Promise.all([
          fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
          fetch("/api/products/with-stock-profile?limit=500", { cache: "no-store", credentials: "include" }),
        ]);
        const whJ = await whRes.json();
        const prodJ = await prodRes.json();
        if (cancelled) return;
        const ws = (whJ.warehouses ?? []) as Warehouse[];
        setWarehouses(ws);
        const def = ws.find((w) => w.is_default) ?? ws[0];
        if (def) setSourceId(def.id);
        const second = ws.find((w) => w.id !== (def?.id ?? ""));
        if (second) setDestinationId(second.id);
        setProducts(((prodJ.products ?? []) as ProductOption[]).filter((p) => p.stock_profile));
      } catch (e) {
        setError(humanizeError(e instanceof Error ? e.message : String(e)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        key: Math.random().toString(36).slice(2),
        inventory_item_id: "",
        product_label: "",
        quantity: "",
        unit_of_measure: "pcs",
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
    if (!sourceId || !destinationId) {
      setError(t("inv.transfers.form.same_warehouse"));
      return;
    }
    if (sourceId === destinationId) {
      setError(t("inv.transfers.form.same_warehouse"));
      return;
    }
    if (lines.length === 0) {
      setError(t("inv.transfers.form.need_items"));
      return;
    }
    const items = lines.map((l) => ({
      inventory_item_id: l.inventory_item_id,
      quantity: Number(l.quantity),
      unit_of_measure: l.unit_of_measure,
    }));
    for (const it of items) {
      if (!it.inventory_item_id || !Number.isFinite(it.quantity) || it.quantity <= 0) {
        setError(t("inv.transfers.form.need_items"));
        return;
      }
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/inventory/transfers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_warehouse_id: sourceId,
          destination_warehouse_id: destinationId,
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
      if (j.transfer?.id) router.push(`/inventory/transfers/${j.transfer.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 bg-black/40"
        aria-label="Close"
      />
      <div className="w-full max-w-xl overflow-y-auto border-l border-[var(--border-color)] bg-[var(--bg-primary)] p-5 text-[var(--text-primary)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.transfers.title")}
            </div>
            <div className="mt-0.5 text-[15px] font-medium">{t("inv.transfers.new")}</div>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.transfers.form.source")}
            </div>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              <option value="">—</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("inv.transfers.form.destination")}
            </div>
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            >
              <option value="">—</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
            {t("inv.transfers.form.notes")}
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
              {t("inv.transfers.detail.items")}
            </div>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] hover:bg-[var(--bg-elevated)]"
            >
              <RrIcon name="plus" size={10} />
              {t("inv.transfers.form.add_item")}
            </button>
          </div>

          <datalist id="transfer-product-options">
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
                {t("inv.transfers.form.need_items")}
              </div>
            )}
            {lines.map((l) => (
              <div
                key={l.key}
                className="grid grid-cols-12 gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)]/40 p-2"
              >
                <input
                  list="transfer-product-options"
                  value={l.product_label}
                  onChange={(e) => onPickProduct(l.key, e.target.value)}
                  placeholder={t("inv.transfers.form.item")}
                  className="col-span-7 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-[11.5px]"
                />
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={l.quantity}
                  onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                  placeholder={t("inv.transfers.form.qty")}
                  className="col-span-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-right text-[11.5px] tabular-nums"
                />
                <input
                  value={l.unit_of_measure}
                  onChange={(e) => updateLine(l.key, { unit_of_measure: e.target.value })}
                  placeholder={t("inv.transfers.form.unit")}
                  className="col-span-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1 text-[11.5px]"
                />
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  className="col-span-1 rounded-md border border-[var(--border-color)] px-2 py-1 text-[11px] text-[var(--text-dim)] hover:text-rose-400"
                  title={t("inv.transfers.form.remove")}
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
            {submitting ? "…" : t("inv.transfers.form.save_draft")}
          </button>
        </div>
      </div>
    </div>
  );
}
