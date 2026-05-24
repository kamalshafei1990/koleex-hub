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
  movementLabel,
} from "@/components/inventory/InventoryUi";
import RrIcon from "@/components/ui/RrIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation, type Translations } from "@/lib/i18n";
import Link from "next/link";
import InventoryMovementDetail from "@/components/inventory/InventoryMovementDetail";
import {
  BulkActionBar,
  HumanStatusPill,
  MobileBottomBar,
  MobileFab,
  OperatorMovementMenu,
  WarningChip,
  operatorLabel,
  relativeTime,
  useInventoryShortcuts,
  useSelection,
} from "@/components/inventory/InventoryUx";

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
  /* INV-H5B — picker tabs */
  "mv.pick_products":    { en: "Products",       zh: "产品",     ar: "المنتجات" },
  "mv.pick_internal":    { en: "Internal Use",   zh: "内部使用", ar: "استخدام داخلي" },
  "mv.item":             { en: "Item",           zh: "物品",     ar: "العنصر" },
  "mv.item_hint":        { en: "Search internal-use stock (catalogs, uniforms, office supplies…)", zh: "搜索内部使用库存（目录、工服、办公用品…）", ar: "ابحث في مخزون الاستخدام الداخلي (الكتالوجات، الزي، اللوازم المكتبية…)" },
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
  /* INV-H5D — operator polish strings */
  "mv.details.show":     { en: "View details",   zh: "查看详情",       ar: "عرض التفاصيل" },
  "mv.details.hide":     { en: "Hide details",   zh: "隐藏详情",       ar: "إخفاء التفاصيل" },
  "mv.filters.more":     { en: "More filters",   zh: "更多筛选",       ar: "مزيد من المرشحات" },
  "mv.filters.fewer":    { en: "Fewer filters",  zh: "收起筛选",       ar: "تقليل المرشحات" },
  "mv.action.review":    { en: "Review",         zh: "审核",          ar: "مراجعة" },
  "mv.action.open":      { en: "Open",           zh: "打开",          ar: "فتح" },
  "mv.raw.movement_type":{ en: "Raw movement type", zh: "原始动作类型", ar: "نوع الحركة الخام" },
  "mv.raw.audit_id":     { en: "Audit row id",   zh: "审计记录ID",     ar: "معرف السجل" },
  "mv.raw.source":       { en: "Source document",zh: "来源单据",       ar: "مستند المصدر" },
  "mv.raw.posted_at":    { en: "Posted at",      zh: "过账时间",       ar: "وقت الترحيل" },
  "mv.raw.voided_at":    { en: "Voided at",      zh: "作废时间",       ar: "وقت الإبطال" },
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
  useInventoryShortcuts({ isActive: true });
  const selection = useSelection<string>();
  /* INV-H5D — per-row "View details" disclosure + secondary-filter toggle */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  /* INV-H5A — operator menu deep-links: ?create=receive|ship|adjustment|… */
  const [pendingCreate, setPendingCreate] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const create = params.get("create");
    if (create) setPendingCreate(create);
  }, []);

  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("workflow");
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  /* Form state — only adjustments. */
  /* INV-H5B — picker tab toggle between product-linked items and internal-use items. */
  const [pickerTab, setPickerTab] = useState<"products" | "internal">("products");
  const [internalItems, setInternalItems] = useState<Array<{
    id: string; item_code: string; item_name: string; brand: string | null;
    unit_of_measure: string; type_name: string; usage_scope?: string;
  }>>([]);
  const [internalItemId, setInternalItemId] = useState<string>("");
  const [internalQuery, setInternalQuery] = useState("");
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
  /* INV-H4A — optional variant + batch pickers. */
  const [variantId, setVariantId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [variantOptions, setVariantOptions] = useState<Array<{ id: string; variant_name: string }>>([]);
  const [batchOptions, setBatchOptions] = useState<Array<{ id: string; batch_no: string; variant_id: string | null; expiry_date: string | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [whRes, prodRes, invRes] = await Promise.all([
          fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
          fetch("/api/products/with-stock-profile?limit=500", { cache: "no-store", credentials: "include" }),
          /* INV-H5B — internal-use items live in inventory_items but have no
             linked product. Pull a generous page and filter client-side. */
          fetch("/api/inventory/items?status=active&limit=500", { cache: "no-store", credentials: "include" }),
        ]);
        const whJ = await whRes.json();
        const prodJ = await prodRes.json();
        const invJ = await invRes.json();
        if (cancelled) return;
        setProducts((prodJ.products ?? []) as ProductOption[]);
        const whList = (whJ.warehouses ?? []) as Warehouse[];
        setWarehouses(whList);
        const def = whList.find((w) => w.is_default) ?? whList[0];
        if (def) setWarehouseId(def.id);
        const allItems = (invJ.items ?? []) as Array<{
          id: string; item_code: string; item_name: string; brand: string | null;
          unit_of_measure: string; type_name: string;
          usage_scope?: string; requires_product?: boolean;
          linked_product_id?: string | null;
        }>;
        setInternalItems(
          allItems
            .filter((it) => it.usage_scope === "internal_use" || it.requires_product === false || !it.linked_product_id)
            .map((it) => ({
              id: it.id, item_code: it.item_code, item_name: it.item_name,
              brand: it.brand, unit_of_measure: it.unit_of_measure,
              type_name: it.type_name, usage_scope: it.usage_scope,
            })),
        );
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

  /* Apply ?create= deep-link once the form state is wired. */
  useEffect(() => {
    if (!pendingCreate) return;
    setShowForm(true);
    if (pendingCreate === "ship") setDirection("out");
    else if (pendingCreate === "receive") setDirection("in");
    setPendingCreate(null);
  }, [pendingCreate]);

  /* INV-H4A — load variants when item changes; reset variant/batch. */
  useEffect(() => {
    const itemId = selectedProduct?.stock_profile?.inventory_item_id;
    if (!itemId) {
      setVariantOptions([]);
      setVariantId("");
      setBatchOptions([]);
      setBatchId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/inventory/variants?item_id=${itemId}&status=active&limit=200`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        setVariantOptions(((j.variants ?? []) as Array<{ id: string; variant_name: string }>).map((v) => ({
          id: v.id,
          variant_name: v.variant_name,
        })));
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, [selectedProduct?.stock_profile?.inventory_item_id]);

  /* INV-H4A — load batches for the (item, variant) pair. */
  useEffect(() => {
    const itemId = selectedProduct?.stock_profile?.inventory_item_id;
    if (!itemId) {
      setBatchOptions([]);
      setBatchId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const url = new URL("/api/inventory/batches", window.location.origin);
        url.searchParams.set("item_id", itemId);
        url.searchParams.set("limit", "200");
        if (variantId) url.searchParams.set("variant_id", variantId);
        const r = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled) return;
        const all = (j.batches ?? []) as Array<{ id: string; batch_no: string; variant_id: string | null; expiry_date: string | null }>;
        // If no variant chosen, only show batches without a variant; else show only those matching.
        const filtered = variantId
          ? all.filter((b) => b.variant_id === variantId)
          : all.filter((b) => b.variant_id == null);
        setBatchOptions(filtered);
        // Clear batch if it's no longer in options.
        if (batchId && !filtered.find((b) => b.id === batchId)) setBatchId("");
        /* INV-H5A — FEFO suggestion: when no batch chosen yet, pre-select
           the earliest-expiry batch as a hint. Operator can override. */
        if (!batchId && filtered.length > 0) {
          const withExp = filtered.filter((b) => b.expiry_date);
          if (withExp.length > 0) {
            const fefo = withExp.slice().sort((a, b) => (a.expiry_date ?? "") < (b.expiry_date ?? "") ? -1 : 1)[0];
            if (fefo) setBatchId(fefo.id);
          }
        }
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
    // batchId is intentionally NOT a dep (would loop on clear)
  }, [selectedProduct?.stock_profile?.inventory_item_id, variantId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (pickerTab === "products") {
      if (!selectedProduct?.stock_profile) { setSubmitError(t("mv.no_profile")); return; }
    } else {
      if (!internalItemId) { setSubmitError("Pick an internal-use item"); return; }
    }
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
      const pickerPayload: Record<string, unknown> = pickerTab === "products"
        ? { product_id: selectedProduct!.product_id }
        : { inventory_item_id: internalItemId };
      const r = await fetch("/api/inventory/movements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pickerPayload,
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
          /* INV-H4A — optional variant + batch (only meaningful for product items). */
          variant_id: pickerTab === "products" ? (variantId || null) : null,
          batch_id:   pickerTab === "products" ? (batchId   || null) : null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setSubmitError(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
      setQuantity(""); setReference(""); setNotes(""); setReason(""); setUnitCost("");
      setVariantId(""); setBatchId("");
      setInternalItemId(""); setInternalQuery("");
      setFlash("Submitted for approval.");
      window.setTimeout(() => setFlash(null), 2500);
      setShowForm(false);
      setTab("drafts");
      await loadMovements();
    } finally {
      setSubmitting(false);
    }
  };

  /* INV-H5A bulk operations: approve drafts / void drafts */
  const bulkApprove = async () => {
    if (selection.count === 0) return;
    const ids = [...selection.ids];
    for (const id of ids) {
      try {
        await fetch(`/api/inventory/movements/${id}/approve`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });
      } catch { /* swallow — re-loaded below */ }
    }
    selection.clear();
    await loadMovements();
  };
  const bulkVoid = async () => {
    if (selection.count === 0) return;
    const reason = window.prompt("Void reason (min 3 chars)?") ?? "";
    if (reason.trim().length < 3) return;
    const ids = [...selection.ids];
    for (const id of ids) {
      try {
        await fetch(`/api/inventory/movements/${id}/void`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ void_reason: reason.trim() }),
        });
      } catch { /* */ }
    }
    selection.clear();
    await loadMovements();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader icon="file-invoice" title={t("mv.title")} subtitle={t("mv.subtitle")} />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* INV-H5A — operator-first create menu */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <OperatorMovementMenu />
          <div className="text-[10.5px] text-[var(--text-dim)]">
            {/* helpful hint — desktop only */}
            <span className="hidden sm:inline">Shortcuts: R · S · T · A · F</span>
          </div>
        </div>

        {/* Tabs + Create.
            INV-H5D — primary chips (Workflow, Adjustments, Drafts) stay
            visible; the secondary status filters (Posted / Voided) hide
            behind "More filters". */}
        <div className="flex flex-wrap items-center gap-1.5">
          <TabBtn active={tab === "workflow"}     onClick={() => setTab("workflow")}>{t("mv.tab.workflow")}</TabBtn>
          <TabBtn active={tab === "adjustments"}  onClick={() => setTab("adjustments")}>{t("mv.tab.adjustments")}</TabBtn>
          <TabBtn active={tab === "drafts"}       onClick={() => setTab("drafts")}>{t("mv.tab.drafts")}</TabBtn>
          {showMoreFilters && (
            <>
              <TabBtn active={tab === "posted"} onClick={() => setTab("posted")}>{t("mv.tab.posted")}</TabBtn>
              <TabBtn active={tab === "voided"} onClick={() => setTab("voided")}>{t("mv.tab.voided")}</TabBtn>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className="rounded-md border border-[var(--border-subtle)] bg-transparent px-2.5 py-1.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            {showMoreFilters ? t("mv.filters.fewer") : t("mv.filters.more")}
          </button>
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

            {/* INV-H5B — picker source tabs */}
            <div className="md:col-span-2">
              <div className="mb-2 inline-flex rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] p-0.5 text-[11.5px]">
                <button
                  type="button"
                  onClick={() => setPickerTab("products")}
                  className={`rounded px-2.5 py-1 ${pickerTab === "products" ? "bg-[var(--bg-primary)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}
                >
                  {t("mv.pick_products")}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab("internal")}
                  className={`rounded px-2.5 py-1 ${pickerTab === "internal" ? "bg-[var(--bg-primary)] text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}
                >
                  {t("mv.pick_internal")}
                </button>
              </div>
              {pickerTab === "products" ? (
                <label className="block">
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
              ) : (
                <label className="block">
                  <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                    {t("mv.item")}
                  </div>
                  <input
                    list="inv-h5b-internal-list"
                    value={internalQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setInternalQuery(v);
                      const match = internalItems.find(
                        (it) =>
                          `${it.item_code} · ${it.item_name}${it.brand ? " · " + it.brand : ""}` === v
                          || it.item_name === v
                          || it.item_code === v,
                      );
                      setInternalItemId(match?.id ?? "");
                      if (match) setUnit(match.unit_of_measure);
                    }}
                    placeholder={t("mv.item_hint")}
                    className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                  />
                  <datalist id="inv-h5b-internal-list">
                    {internalItems.slice(0, 500).map((it) => (
                      <option
                        key={it.id}
                        value={`${it.item_code} · ${it.item_name}${it.brand ? " · " + it.brand : ""}`}
                      />
                    ))}
                  </datalist>
                  {internalItems.length === 0 && (
                    <p className="mt-1 text-[10.5px] text-[var(--text-dim)]">
                      No internal-use items yet. Create one from <Link href="/inventory/items" className="underline">Stock Profiles</Link>.
                    </p>
                  )}
                </label>
              )}
            </div>

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

            {/* INV-H4A — Variant + Batch optional pickers. */}
            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                Variant (optional)
              </div>
              <select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                disabled={!selectedProduct?.stock_profile}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] disabled:opacity-50"
              >
                <option value="">—</option>
                {variantOptions.map((v) => (
                  <option key={v.id} value={v.id}>{v.variant_name}</option>
                ))}
              </select>
              {selectedProduct?.stock_profile && variantOptions.length === 0 && (
                <div className="mt-0.5 text-[10px] text-[var(--text-dim)]">No variants for this item.</div>
              )}
            </label>

            <label className="block">
              <div className="mb-1 text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
                Batch (optional)
              </div>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={!selectedProduct?.stock_profile}
                className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] disabled:opacity-50"
              >
                <option value="">—</option>
                {batchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_no}{b.expiry_date ? ` · exp ${b.expiry_date}` : ""}
                  </option>
                ))}
              </select>
              {selectedProduct?.stock_profile && batchOptions.length === 0 && (
                <div className="mt-0.5 text-[10px] text-[var(--text-dim)]">No batches match.</div>
              )}
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

        {/* Ledger — INV-H5D operator-first list.
            Visible row: icon · product/item · operator label · qty ·
            warehouse · humanized status pill · primary action. Raw enum,
            audit row id, full timestamps, source document — all collapse
            behind "View details". */}
        <Panel>
          {loading && filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] text-[var(--text-dim)]">Loading…</div>
          ) : filtered.length === 0 ? (
            <InventoryEmpty title={`No ${tab} movements`} hint="Try a different tab." />
          ) : (
            <ul role="list" className="divide-y divide-[var(--border-color)]/40">
              {filtered.map((m) => {
                const wh = warehouseMap.get(m.warehouse_id);
                const product = productItemMap.get(m.inventory_item_id);
                const isStaleDraft = (() => {
                  if (m.status !== "draft") return false;
                  const d = Date.parse(m.movement_date);
                  if (!Number.isFinite(d)) return false;
                  return Date.now() - d > 7 * 86400_000;
                })();
                const canSelect = m.status === "draft" || m.approval_status === "pending";
                const isExpanded = expanded.has(m.id);
                const primaryActionLabel = canSelect ? t("mv.action.review") : t("mv.action.open");
                const displayName = product?.product_name ?? "—";
                const subline = (() => {
                  const parts: string[] = [];
                  if (wh) parts.push(wh.code);
                  parts.push(movementLabel(m.movement_type));
                  parts.push(relativeTime(m.movement_date));
                  return parts.join(" · ");
                })();
                return (
                  <li
                    key={m.id}
                    className="px-3 py-3.5 transition-colors hover:bg-[var(--bg-surface)]/60 sm:px-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      {/* Select checkbox — only meaningful for actionable rows. */}
                      {canSelect ? (
                        <input
                          type="checkbox"
                          checked={selection.has(m.id)}
                          onChange={() => selection.toggle(m.id)}
                          aria-label={`Select ${m.movement_no}`}
                          className="hidden sm:block"
                        />
                      ) : (
                        <span className="hidden sm:block sm:w-[16px]" aria-hidden />
                      )}

                      {/* Image or fallback icon */}
                      {product?.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={product.image_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
                          <RrIcon name="box-open" size={14} />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-base font-medium text-[var(--text-primary)]">
                            {displayName}
                          </span>
                          <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] text-[var(--text-secondary)]">
                            {operatorLabel(m.movement_type)}
                          </span>
                          {m.source_type && (
                            <span className="rounded border border-[var(--border-subtle)] px-1.5 py-0 text-[9.5px] uppercase tracking-wider text-[var(--text-dim)]">
                              system
                            </span>
                          )}
                          {isStaleDraft && (
                            <WarningChip tone="warning">Draft &gt;7d</WarningChip>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-[var(--text-dim)]">
                          {subline}
                        </div>
                      </div>

                      {/* Qty */}
                      <div className="text-right tabular-nums">
                        <DirectionDelta direction={m.direction} quantity={m.quantity} unit={m.unit} />
                      </div>

                      {/* Humanized status + primary action */}
                      <div className="flex items-center gap-2 sm:ml-2">
                        <HumanStatusPill status={m.status} />
                        <button
                          type="button"
                          onClick={() => setDetailId(m.id)}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] sm:min-h-0 sm:py-1.5"
                        >
                          {primaryActionLabel}
                        </button>
                      </div>
                    </div>

                    {/* INV-H5D — collapsed details. Raw movement_type,
                        audit row id, source-document raw id, raw
                        timestamps, approval enum live here. */}
                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => toggleExpand(m.id)}
                        className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:underline"
                      >
                        {isExpanded ? t("mv.details.hide") : t("mv.details.show")}
                      </button>
                    </div>
                    {isExpanded && (
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 px-3 py-2 text-[11px] sm:grid-cols-2">
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">Movement #</dt>
                          <dd className="font-mono text-[var(--text-secondary)]">{m.movement_no}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("mv.raw.audit_id")}</dt>
                          <dd className="font-mono text-[var(--text-secondary)] truncate">{m.id}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("mv.raw.movement_type")}</dt>
                          <dd className="text-[var(--text-secondary)]">{m.movement_type} → {operatorLabel(m.movement_type)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">Date</dt>
                          <dd className="text-[var(--text-secondary)]">{m.movement_date}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">Location</dt>
                          <dd className="text-[var(--text-secondary)]">
                            {wh ? (
                              <span className="inline-flex items-center gap-1.5">
                                {wh.code}
                                <LocationTypeChip type={wh.location_type} />
                              </span>
                            ) : "—"}
                          </dd>
                        </div>
                        {product?.stock_profile?.item_code && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-[var(--text-dim)]">Item code</dt>
                            <dd className="font-mono text-[var(--text-secondary)]">
                              {product.sku ? `${product.sku} · ` : ""}{product.stock_profile.item_code}
                            </dd>
                          </div>
                        )}
                        {m.source_type && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-[var(--text-dim)]">{t("mv.raw.source")}</dt>
                            <dd className="text-[var(--text-secondary)]">{m.source_type}</dd>
                          </div>
                        )}
                        {m.reference && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-[var(--text-dim)]">Reference</dt>
                            <dd className="text-[var(--text-secondary)]">{m.reference}</dd>
                          </div>
                        )}
                        {m.approval_status && m.approval_status !== "not_required" && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-[var(--text-dim)]">Approval</dt>
                            <dd className="text-[var(--text-secondary)]">{m.approval_status}</dd>
                          </div>
                        )}
                        {m.posted_at && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-[var(--text-dim)]">{t("mv.raw.posted_at")}</dt>
                            <dd className="text-[var(--text-secondary)]">{new Date(m.posted_at).toLocaleString()}</dd>
                          </div>
                        )}
                        {m.voided_at && (
                          <div className="flex justify-between gap-2">
                            <dt className="text-[var(--text-dim)]">{t("mv.raw.voided_at")}</dt>
                            <dd className="text-[var(--text-secondary)]">{new Date(m.voided_at).toLocaleString()}</dd>
                          </div>
                        )}
                        <div className="flex justify-between gap-2 sm:col-span-2">
                          <dt className="text-[var(--text-dim)]">Raw status</dt>
                          <dd className="text-[var(--text-secondary)]">{m.status}</dd>
                        </div>
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {detailId && (
          <InventoryMovementDetail
            movementId={detailId}
            onClose={() => { setDetailId(null); void loadMovements(); }}
          />
        )}
      </div>
      <BulkActionBar
        count={selection.count}
        onClear={selection.clear}
        actions={[
          { label: "Approve all",  icon: "check",     onClick: bulkApprove, tone: "primary" },
          { label: "Void drafts",  icon: "cross",     onClick: bulkVoid,    tone: "danger"  },
        ]}
      />
      <MobileFab />
      <MobileBottomBar />
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
