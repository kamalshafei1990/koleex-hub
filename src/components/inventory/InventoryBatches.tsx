"use client";

/* ---------------------------------------------------------------------------
   /inventory/batches — list + filter + create batch.

   Phase INV-H4A. Tabs: All · Normal · Near expiry · Expired · Depleted.

   Visibility-only — expired stock is not auto-blocked. This page exists so
   operators can see which lots are at risk and act manually.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import RrIcon from "@/components/ui/RrIcon";
import { InventoryEmpty, Panel } from "@/components/inventory/InventoryUi";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";

type ExpiryStatus = "normal" | "near_expiry" | "expired" | "depleted";

interface BatchRow {
  id: string;
  batch_no: string;
  supplier_batch_no: string | null;
  inventory_item_id: string;
  variant_id: string | null;
  warehouse_id: string;
  manufacture_date: string | null;
  expiry_date: string | null;
  quantity_initial: number;
  quantity_remaining: number;
  status: "active" | "archived";
  expiry_status: ExpiryStatus;
  item_code: string | null;
  item_name: string | null;
  variant_name: string | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
  created_at: string;
}

interface Warehouse { id: string; code: string; name: string; is_default: boolean }
interface ItemRow { id: string; item_code: string; item_name: string }
interface VariantRow { id: string; inventory_item_id: string; variant_name: string }

type TabKey = "all" | "normal" | "near_expiry" | "expired" | "depleted";
const TABS: TabKey[] = ["all", "normal", "near_expiry", "expired", "depleted"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function batchStatusClasses(s: ExpiryStatus): string {
  if (s === "expired")
    return "border-rose-500/30 bg-rose-500/10 text-rose-200 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
  if (s === "near_expiry")
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  if (s === "depleted")
    return "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
}

export default function InventoryBatches() {
  const { t } = useTranslation(inventoryT);

  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [tab, setTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, wRes, iRes, vRes] = await Promise.all([
        fetch("/api/inventory/batches?limit=500", { cache: "no-store" }),
        fetch("/api/inventory/warehouses", { cache: "no-store" }),
        fetch("/api/inventory/items?limit=500", { cache: "no-store" }),
        fetch("/api/inventory/variants?limit=500", { cache: "no-store" }),
      ]);
      if (!bRes.ok) throw new Error(humanizeError(bRes.statusText));
      const bData = await bRes.json();
      setBatches(bData.batches ?? []);
      if (wRes.ok) setWarehouses((await wRes.json()).warehouses ?? []);
      if (iRes.ok) setItems((await iRes.json()).items ?? []);
      if (vRes.ok) setVariants((await vRes.json()).variants ?? []);
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === "all") return batches;
    return batches.filter((b) => b.expiry_status === tab);
  }, [batches, tab]);

  return (
    <div className="space-y-6">
      <InventoryHeader
        title={t("inv.batches.title")}
        subtitle={t("inv.batches.subtitle")}
        action={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <RrIcon name="plus" size={12} />
            {t("inv.batches.new")}
          </button>
        }
      />

      {/* tabs */}
      <div className="flex flex-wrap items-center gap-1">
        {TABS.map((k) => {
          const active = tab === k;
          const count = k === "all" ? batches.length : batches.filter((b) => b.expiry_status === k).length;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] transition-colors ${
                active
                  ? "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t(`inv.batches.tab.${k}`)}
              <span className="rounded-full bg-[var(--bg-elevated)] px-1.5 text-[10px] text-[var(--text-dim)]">{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}

      <Panel>
        {loading ? (
          <div className="px-4 py-10 text-center text-[12px] text-[var(--text-dim)]">{t("inv.transfers.loading")}</div>
        ) : filtered.length === 0 ? (
          <InventoryEmpty title={t("inv.batches.empty.title")} hint={t("inv.batches.empty.hint")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-[10.5px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                  <th className="px-3 py-2">{t("inv.batches.col.no")}</th>
                  <th className="px-3 py-2">{t("inv.batches.col.item")}</th>
                  <th className="px-3 py-2">{t("inv.batches.col.variant")}</th>
                  <th className="px-3 py-2">{t("inv.batches.col.warehouse")}</th>
                  <th className="px-3 py-2">{t("inv.batches.col.expiry")}</th>
                  <th className="px-3 py-2 text-right">{t("inv.batches.col.qty")}</th>
                  <th className="px-3 py-2">{t("inv.batches.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)]">
                    <td className="px-3 py-2 font-mono text-[11.5px] text-[var(--text-primary)]">{b.batch_no}</td>
                    <td className="px-3 py-2 text-[var(--text-primary)]">
                      <div>{b.item_name ?? "—"}</div>
                      <div className="text-[10.5px] text-[var(--text-dim)]">{b.item_code ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-primary)]">{b.variant_name ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-primary)]">
                      <div>{b.warehouse_name ?? "—"}</div>
                      <div className="text-[10.5px] text-[var(--text-dim)]">{b.warehouse_code ?? ""}</div>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-primary)]">{fmtDate(b.expiry_date)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {Number(b.quantity_remaining).toLocaleString()} / {Number(b.quantity_initial).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.10em] ${batchStatusClasses(b.expiry_status)}`}>
                        {t(`inv.batches.status.${b.expiry_status}`)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {createOpen && (
        <CreateBatchDrawer
          warehouses={warehouses}
          items={items}
          variants={variants}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ─── Create drawer ──────────────────────────────────────── */
function CreateBatchDrawer({
  warehouses,
  items,
  variants,
  onClose,
  onCreated,
}: {
  warehouses: Warehouse[];
  items: ItemRow[];
  variants: VariantRow[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation(inventoryT);
  const [itemId, setItemId] = useState<string>(items[0]?.id ?? "");
  const [variantId, setVariantId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? "",
  );
  const [batchNo, setBatchNo] = useState("");
  const [supplierNo, setSupplierNo] = useState("");
  const [manufacture, setManufacture] = useState("");
  const [expiry, setExpiry] = useState("");
  const [qty, setQty] = useState("0");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const variantOptions = useMemo(
    () => variants.filter((v) => v.inventory_item_id === itemId),
    [variants, itemId],
  );

  async function submit() {
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_item_id: itemId,
          variant_id: variantId || null,
          warehouse_id: warehouseId,
          batch_no: batchNo || undefined,
          supplier_batch_no: supplierNo || null,
          manufacture_date: manufacture || null,
          expiry_date: expiry || null,
          quantity_initial: Number(qty) || 0,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(humanizeError(data?.error ?? res.statusText));
        return;
      }
      onCreated();
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-5"
        role="dialog"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("inv.batches.new")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="cross" size={14} />
          </button>
        </div>

        {err && (
          <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-200">
            {err}
          </div>
        )}

        <div className="space-y-3 text-[12px]">
          <Field label={t("inv.batches.form.item")}>
            <select
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                setVariantId("");
              }}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[var(--text-primary)]"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_code} — {i.item_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("inv.batches.form.variant")}>
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[var(--text-primary)]"
            >
              <option value="">—</option>
              {variantOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.variant_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("inv.batches.form.warehouse")}>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[var(--text-primary)]"
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("inv.batches.form.no")}>
            <input
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              placeholder="auto"
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
            />
          </Field>

          <Field label={t("inv.batches.form.supplier_no")}>
            <input
              value={supplierNo}
              onChange={(e) => setSupplierNo(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[var(--text-primary)]"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("inv.batches.form.manufacture")}>
              <input
                type="date"
                value={manufacture}
                onChange={(e) => setManufacture(e.target.value)}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[var(--text-primary)]"
              />
            </Field>
            <Field label={t("inv.batches.form.expiry")}>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[var(--text-primary)]"
              />
            </Field>
          </div>

          <Field label={t("inv.batches.form.qty_initial")}>
            <input
              type="number"
              min="0"
              step="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[var(--text-primary)]"
            />
          </Field>

          <Field label={t("inv.batches.form.notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[var(--text-primary)]"
            />
          </Field>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
            >
              {t("inv.transfers.act.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !itemId || !warehouseId}
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-200"
            >
              {submitting ? "…" : t("inv.batches.form.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.10em] text-[var(--text-dim)]">{label}</div>
      {children}
    </label>
  );
}
