"use client";

/* ---------------------------------------------------------------------------
   /inventory/movements — INV-H2 disciplined ledger.

   Tabs (Scope 8):
     · Workflow Movements  — source_type IS NOT NULL (purchase / sales /
                              transfer / return). System-generated;
                              read-only here.
     · Adjustments         — movement_type IN (manual, adjustment_*)
     · Drafts / Posted / Voided  — cut by status.

   The only thing operators can CREATE here is an Adjustment Request
   (manual / adjustment_in / adjustment_out). Receipts and shipments
   live behind their workflow pages.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import type { MovementStatus, MovementType } from "@/lib/inventory/types";
import {
  DirectionDelta,
  InventoryEmpty,
  LocationTypeChip,
  Panel,
  StatusBadge,
  movementLabel,
} from "@/components/inventory/InventoryUi";
import RrIcon from "@/components/ui/RrIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation, type Translations } from "@/lib/i18n";
import Link from "next/link";
import InventoryMovementDetail from "@/components/inventory/InventoryMovementDetail";

const MV_T: Translations = {
  "mv.title":            { en: "Stock Movements", zh: "库存移动", ar: "حركات المخزون" },
  "mv.subtitle":         { en: "Inventory ledger. Receipts and shipments come from their workflows; adjustments require approval.", zh: "库存分录。收货与发货由工作流生成；调整需审批。", ar: "سجل المخزون. الاستلام والشحن من تدفقاتهم؛ التعديلات تتطلب موافقة." },
  "mv.tab.workflow":     { en: "Workflow",       zh: "工作流",   ar: "حركات النظام" },
  "mv.tab.adjustments":  { en: "Adjustments",    zh: "调整",     ar: "تعديلات" },
  "mv.tab.drafts":       { en: "Drafts",         zh: "草稿",     ar: "مسودات" },
  "mv.tab.posted":       { en: "Posted",         zh: "已过账",    ar: "مرحلة" },
  "mv.tab.voided":       { en: "Voided",         zh: "已作废",    ar: "ملغاة" },
  "mv.new":              { en: "New Adjustment Request", zh: "新建调整申请", ar: "طلب تعديل جديد" },
  "mv.workflow_only":    { en: "Receipts and shipments are created from Purchase and Sales workflows.", zh: "收货与发货请在采购与销售工作流中创建。", ar: "يتم إنشاء الاستلام والشحن من تدفقات المشتريات والمبيعات." },
  "mv.product":          { en: "Product",        zh: "产品",     ar: "المنتج" },
  "mv.product_hint":     { en: "Search by name, SKU or brand", zh: "按名称、SKU 或品牌搜索", ar: "ابحث بالاسم أو SKU أو العلامة التجارية" },
  "mv.no_profile":       { en: "This product is not tracked in inventory.", zh: "此产品不在库存中跟踪。", ar: "هذا المنتج غير مُتتبَّع في المخزون." },
  "mv.location":         { en: "Location",       zh: "位置",     ar: "الموقع" },
  "mv.direction":        { en: "Direction",      zh: "方向",     ar: "الاتجاه" },
  "mv.qty":              { en: "Quantity",       zh: "数量",     ar: "الكمية" },
  "mv.unit":             { en: "Unit",           zh: "单位",     ar: "الوحدة" },
  "mv.unit_cost":        { en: "Unit cost",      zh: "单位成本", ar: "تكلفة الوحدة" },
  "mv.reason":           { en: "Reason (required)", zh: "原因（必填）", ar: "السبب (مطلوب)" },
  "mv.reference":        { en: "Reference",      zh: "参考",     ar: "المرجع" },
  "mv.notes":            { en: "Notes",          zh: "备注",     ar: "ملاحظات" },
  "mv.submit":           { en: "Submit for Approval", zh: "提交审批", ar: "إرسال للاعتماد" },
  "mv.submitting":       { en: "Submitting…",    zh: "提交中…",  ar: "جارٍ الإرسال…" },
  "mv.value_required":   { en: "Inventory value is required before stock can be added.", zh: "添加库存前必须填写库存价值。", ar: "قيمة المخزون مطلوبة قبل إضافة المخزون." },
};

interface ProductOption {
  product_id: string;
  product_name: string;
  slug: string;
  brand: string | null;
  sku: string | null;
  model_name: string | null;
  image_url: string | null;
  stock_profile: {
    inventory_item_id: string;
    item_code: string;
    unit_of_measure: string;
    default_warehouse_id: string | null;
  } | null;
}

interface Warehouse {
  id: string; code: string; name: string;
  is_default: boolean;
  location_type?: string | null;
}

interface MovementRow {
  id: string;
  movement_no: string;
  movement_date: string;
  inventory_item_id: string;
  warehouse_id: string;
  movement_type: MovementType;
  direction: "in" | "out";
  quantity: number;
  unit: string;
  reference: string | null;
  status: MovementStatus;
  posted_at: string | null;
  voided_at: string | null;
  source_type?: string | null;
  approval_status?: string;
}

type TabKey = "workflow" | "adjustments" | "drafts" | "posted" | "voided";

const ADJUSTMENT_TYPES: MovementType[] = ["manual", "adjustment_in", "adjustment_out"];
const WORKFLOW_TYPES: MovementType[] = [
  "purchase_receipt", "sales_shipment",
  "return_in", "return_out",
  "transfer_in", "transfer_out",
];

export default function InventoryMovements() {
  const { t } = useTranslation(MV_T);

  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("workflow");
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  /* Form state — only adjustments. */
  const [productQuery, setProductQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

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
        setProducts((prodJ.products ?? []) as ProductOption[]);
        const whList = (whJ.warehouses ?? []) as Warehouse[];
        setWarehouses(whList);
        const def = whList.find((w) => w.is_default) ?? whList[0];
        if (def) setWarehouseId(def.id);
      } catch {
        /* surface via movement load instead */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const productItemMap = useMemo(() => {
    const m = new Map<string, ProductOption>();
    for (const p of products) {
      if (p.stock_profile) m.set(p.stock_profile.inventory_item_id, p);
    }
    return m;
  }, [products]);

  const warehouseMap = useMemo(() => {
    const m = new Map<string, Warehouse>();
    for (const w of warehouses) m.set(w.id, w);
    return m;
  }, [warehouses]);

  const loadMovements = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "200");
      const r = await fetch(`/api/inventory/movements?${qs.toString()}`, {
        cache: "no-store", credentials: "include",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setMovements((j.movements ?? []) as MovementRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMovements(); }, [loadMovements]);

  /* Tab filtering. */
  const filtered = useMemo(() => {
    switch (tab) {
      case "workflow":
        return movements.filter(
          (m) => !!m.source_type || WORKFLOW_TYPES.includes(m.movement_type),
        );
      case "adjustments":
        return movements.filter((m) => ADJUSTMENT_TYPES.includes(m.movement_type));
      case "drafts":
        return movements.filter((m) => m.status === "draft");
      case "posted":
        return movements.filter((m) => m.status === "posted");
      case "voided":
        return movements.filter((m) => m.status === "voided");
      default:
        return movements;
    }
  }, [movements, tab]);

  const submitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null); setFlash(null);
    const qty = Number(quantity);
    if (!selectedProduct?.stock_profile) { setSubmitError(t("mv.no_profile")); return; }
    if (!warehouseId) { setSubmitError("Pick a location"); return; }
    if (!Number.isFinite(qty) || qty <= 0) { setSubmitError("Quantity must be > 0"); return; }
    if (!reason.trim() || reason.trim().length < 3) {
      setSubmitError("Reason is required (min 3 characters).");
      return;
    }
    const cost = unitCost ? Number(unitCost) : null;
    if (direction === "in" && (cost == null || cost <= 0)) {
      setSubmitError(t("mv.value_required"));
      return;
    }
    setSubmitting(true);
    try {
      const movement_type: MovementType = direction === "in" ? "adjustment_in" : "adjustment_out";
      const r = await fetch("/api/inventory/movements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.product_id,
          warehouse_id: warehouseId,
          movement_type,
          direction,
          quantity: qty,
          unit,
          unit_cost: direction === "in" ? cost : null,
          reference: reference || null,
          notes: notes || null,
          adjustment_reason: reason.trim(),
          post: false, // Always draft — Scope 3.
        }),
      });
      const j = await r.json();
      if (!r.ok) { setSubmitError(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
      setQuantity(""); setReference(""); setNotes(""); setReason(""); setUnitCost("");
      setFlash("Submitted for approval.");
      window.setTimeout(() => setFlash(null), 2500);
      setShowForm(false);
      setTab("drafts");
      await loadMovements();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader title={t("mv.title")} subtitle={t("mv.subtitle")} />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* Tabs + Create */}
        <div className="flex flex-wrap items-center gap-2">
          <TabBtn active={tab === "workflow"}     onClick={() => setTab("workflow")}>{t("mv.tab.workflow")}</TabBtn>
          <TabBtn active={tab === "adjustments"}  onClick={() => setTab("adjustments")}>{t("mv.tab.adjustments")}</TabBtn>
          <TabBtn active={tab === "drafts"}       onClick={() => setTab("drafts")}>{t("mv.tab.drafts")}</TabBtn>
          <TabBtn active={tab === "posted"}       onClick={() => setTab("posted")}>{t("mv.tab.posted")}</TabBtn>
          <TabBtn active={tab === "voided"}       onClick={() => setTab("voided")}>{t("mv.tab.voided")}</TabBtn>
          <div className="ml-auto flex items-center gap-2">
            <div className="text-[11px] text-[var(--text-dim)] tabular-nums">
              {loading ? "…" : `${filtered.length} of ${movements.length}`}
            </div>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-elevated)]"
            >
              <RrIcon name="plus" size={12} />
              {t("mv.new")}
            </button>
          </div>
        </div>

        {tab === "workflow" && (
          <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)]/40 px-3 py-2 text-[11.5px] text-[var(--text-dim)]">
            {t("mv.workflow_only")}
          </div>
        )}

        {flash && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11.5px] text-emerald-200">
            {flash}
          </div>
        )}

        {showForm && (
          <form
            onSubmit={submitAdjustment}
            className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]/40 p-4 md:grid-cols-2"
          >
            <div className="md:col-span-2 text-[11px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t("mv.new")}
            </div>

            <label className="block md:col-span-2">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {t("mv.product")}
              </div>
              <input
                list="inv-h2-product-list"
                value={productQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setProductQuery(v);
                  const match = products.find(
                    (p) =>
                      [p.product_name, p.brand, p.sku, p.model_name].filter(Boolean).join(" · ") === v
                      || p.product_name === v,
                  );
                  setSelectedProduct(match ?? null);
                }}
                placeholder={t("mv.product_hint")}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
              <datalist id="inv-h2-product-list">
                {products.slice(0, 500).map((p) => (
                  <option
                    key={p.product_id}
                    value={[p.product_name, p.brand, p.sku, p.model_name].filter(Boolean).join(" · ")}
                  />
                ))}
              </datalist>
              {selectedProduct && !selectedProduct.stock_profile && (
                <Link
                  href={`/products/${selectedProduct.slug || selectedProduct.product_id}/edit#stock-profile`}
                  className="mt-1 inline-block text-[10.5px] text-[var(--accent-primary,#3b82f6)] hover:underline"
                >
                  {t("mv.no_profile")} →
                </Link>
              )}
            </label>

            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {t("mv.location")}
              </div>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {t("mv.direction")}
              </div>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "in" | "out")}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              >
                <option value="in">IN (+) — Adjustment IN</option>
                <option value="out">OUT (−) — Adjustment OUT</option>
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {t("mv.qty")}
              </div>
              <input
                type="number" min="0" step="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {t("mv.unit")}
              </div>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>

            {direction === "in" && (
              <label className="block md:col-span-2">
                <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  {t("mv.unit_cost")}
                </div>
                <input
                  type="number" min="0" step="0.0001"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="Required for IN adjustments"
                  className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums"
                />
              </label>
            )}

            <label className="block md:col-span-2">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {t("mv.reason")}
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {t("mv.reference")}
              </div>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="ticket #, INV-…"
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {t("mv.notes")}
              </div>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
              />
            </label>

            {submitError && (
              <div className="md:col-span-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11.5px] text-rose-300">
                {submitError}
              </div>
            )}

            <div className="md:col-span-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-surface)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                {!submitting && <RrIcon name="check" size={12} />}
                {submitting ? t("mv.submitting") : t("mv.submit")}
              </button>
            </div>
          </form>
        )}

        {/* Ledger */}
        <Panel>
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Movement #</th>
                <th className="px-3 py-2 text-left">Product</th>
                <th className="px-3 py-2 text-left">Location</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Approval</th>
                <th className="px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-[11px] text-[var(--text-dim)]">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-0 py-0">
                  <InventoryEmpty title={`No ${tab} movements`} hint="Try a different tab." />
                </td></tr>
              ) : (
                filtered.map((m) => {
                  const wh = warehouseMap.get(m.warehouse_id);
                  const product = productItemMap.get(m.inventory_item_id);
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-[var(--border-color)]/40 last:border-b-0 hover:bg-[var(--bg-surface)]/60"
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap text-[var(--text-dim)]">{m.movement_date}</td>
                      <td className="px-3 py-1.5 font-mono text-[11.5px] text-[var(--text-secondary)] whitespace-nowrap">{m.movement_no}</td>
                      <td className="px-3 py-1.5 text-[var(--text-primary)]">
                        {product ? (
                          <span className="inline-flex items-center gap-2">
                            {product.image_url && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={product.image_url} alt="" className="h-7 w-7 rounded object-cover bg-[var(--bg-surface)]" />
                            )}
                            <span className="flex flex-col min-w-0">
                              <span className="truncate text-[12px]">{product.product_name}</span>
                              <span className="font-mono text-[10.5px] text-[var(--text-dim)]">
                                {product.sku ? <>{product.sku} · </> : null}{product.stock_profile?.item_code}
                              </span>
                            </span>
                          </span>
                        ) : <span className="text-[var(--text-dim)]">—</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        {wh ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[11.5px] text-[var(--text-secondary)]">{wh.code}</span>
                            <LocationTypeChip type={wh.location_type} />
                          </span>
                        ) : <span className="text-[var(--text-dim)]">—</span>}
                      </td>
                      <td className="px-3 py-1.5 text-[11.5px] text-[var(--text-secondary)] whitespace-nowrap">
                        {movementLabel(m.movement_type)}
                        {m.source_type && (
                          <span className="ml-1.5 rounded border border-[var(--border-color)] px-1 py-0.5 text-[9.5px] uppercase tracking-wider text-[var(--text-dim)]">
                            system
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <DirectionDelta direction={m.direction} quantity={m.quantity} unit={m.unit} />
                      </td>
                      <td className="px-3 py-1.5"><StatusBadge status={m.status} /></td>
                      <td className="px-3 py-1.5 text-[11px] text-[var(--text-dim)]">
                        {m.approval_status && m.approval_status !== "not_required" ? m.approval_status : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailId(m.id)}
                          className="text-[11px] text-[var(--text-secondary)] hover:underline"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Panel>

        {detailId && (
          <InventoryMovementDetail
            movementId={detailId}
            onClose={() => { setDetailId(null); void loadMovements(); }}
          />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-[11.5px] transition-colors ${
        active
          ? "border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
          : "border-[var(--border-color)] bg-transparent text-[var(--text-dim)] hover:bg-[var(--bg-surface)]"
      }`}
    >
      {children}
    </button>
  );
}
