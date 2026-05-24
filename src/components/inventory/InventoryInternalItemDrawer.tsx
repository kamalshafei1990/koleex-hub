"use client";

/* ---------------------------------------------------------------------------
   PHASE INV-H9 — Card-based Internal Item picker.

   A 3-step drawer for creating internal-use inventory items (office supplies,
   uniforms, exhibition materials, etc.) without forcing the operator through
   dropdowns:

     Step 1 — Pick a category (10 visual cards, one per internal type_key).
     Step 2 — Pick a subcategory (chip cards) or "Custom…" free text.
     Step 3 — Minimal details (name + warehouse + qty + unit + optional notes).

   Skips the type-dropdown entirely. Posts to POST /api/inventory/items with
   {type_key, subcategory, linked_product_id: null, ...}.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation, type Translations } from "@/lib/i18n";
import { INTERNAL_TAXONOMY, type InternalCategoryHint } from "@/lib/inventory/internal-taxonomy";
import { ALLOWED_UNITS, type UnitOfMeasure, type IconName } from "@/lib/inventory/types";

const T: Translations = {
  "inv.int.title":         { en: "Add Internal Item",       zh: "添加内部物品",     ar: "إضافة عنصر داخلي" },
  "inv.int.step1.eyebrow": { en: "Step 1 of 3",             zh: "第 1/3 步",         ar: "الخطوة 1 من 3" },
  "inv.int.step2.eyebrow": { en: "Step 2 of 3",             zh: "第 2/3 步",         ar: "الخطوة 2 من 3" },
  "inv.int.step3.eyebrow": { en: "Step 3 of 3",             zh: "第 3/3 步",         ar: "الخطوة 3 من 3" },
  "inv.int.step1.title":   { en: "What kind of item?",      zh: "什么类型的物品？",   ar: "أي نوع من العناصر؟" },
  "inv.int.step2.title":   { en: "Pick a subcategory",      zh: "选择子类别",         ar: "اختر فئة فرعية" },
  "inv.int.step3.title":   { en: "Item details",            zh: "物品详情",           ar: "تفاصيل العنصر" },
  "inv.int.back":          { en: "Back",                    zh: "返回",               ar: "رجوع" },
  "inv.int.custom":        { en: "Custom…",                 zh: "自定义…",            ar: "مخصص…" },
  "inv.int.custom.placeholder": { en: "Type a subcategory…", zh: "输入子类别…",        ar: "اكتب فئة فرعية…" },
  "inv.int.name":          { en: "Item name",               zh: "物品名称",           ar: "اسم العنصر" },
  "inv.int.name.ph":       { en: "e.g. A4 Printer Paper",   zh: "例：A4 打印纸",      ar: "مثال: ورق طابعة A4" },
  "inv.int.warehouse":     { en: "Warehouse",               zh: "仓库",               ar: "المستودع" },
  "inv.int.qty":           { en: "Quantity",                zh: "数量",               ar: "الكمية" },
  "inv.int.unit":          { en: "Unit",                    zh: "单位",               ar: "الوحدة" },
  "inv.int.notes":         { en: "Notes (optional)",        zh: "备注（可选）",        ar: "ملاحظات (اختياري)" },
  "inv.int.notes.ph":      { en: "Anything the next person should know…", zh: "下一个人需要了解的内容…", ar: "أي شيء يجب أن يعرفه الشخص التالي…" },
  "inv.int.notes.add":     { en: "Add notes",               zh: "添加备注",           ar: "إضافة ملاحظات" },
  "inv.int.notes.hide":    { en: "Hide notes",              zh: "隐藏备注",           ar: "إخفاء الملاحظات" },
  "inv.int.save":          { en: "Create item",             zh: "创建物品",           ar: "إنشاء عنصر" },
  "inv.int.saving":        { en: "Saving…",                 zh: "保存中…",            ar: "جارٍ الحفظ…" },
  "inv.int.cancel":        { en: "Cancel",                  zh: "取消",               ar: "إلغاء" },
  "inv.int.close":         { en: "Close",                   zh: "关闭",               ar: "إغلاق" },
  "inv.int.opening.note":  { en: "An opening-balance movement will be posted automatically.", zh: "将自动过账期初余额。", ar: "سيتم ترحيل حركة رصيد افتتاحي تلقائياً." },
  "inv.int.err.name":      { en: "Item name required.",     zh: "请填写物品名称。",     ar: "اسم العنصر مطلوب." },
  "inv.int.err.warehouse": { en: "Pick a warehouse for the opening quantity.", zh: "请选择期初数量的仓库。", ar: "اختر مستودعاً للكمية الافتتاحية." },
  /* Category labels — keep en in sync with INTERNAL_TAXONOMY for fallback. */
  "inv.int.cat.office_supply":       { en: "Office Supplies",      zh: "办公用品",     ar: "اللوازم المكتبية" },
  "inv.int.cat.marketing_material":  { en: "Marketing Materials",  zh: "营销物料",     ar: "مواد تسويقية" },
  "inv.int.cat.exhibition_material": { en: "Exhibition Materials", zh: "展会物料",     ar: "مواد المعارض" },
  "inv.int.cat.employee_item":       { en: "Employee Items",       zh: "员工物品",     ar: "عناصر الموظفين" },
  "inv.int.cat.packaging_material":  { en: "Packaging",            zh: "包装",         ar: "تغليف" },
  "inv.int.cat.maintenance_item":    { en: "Maintenance",          zh: "维护",         ar: "صيانة" },
  "inv.int.cat.it_equipment":        { en: "IT & Electronics",     zh: "IT 与电子",    ar: "تكنولوجيا وإلكترونيات" },
  "inv.int.cat.printed_material":    { en: "Documents & Printing", zh: "文档与印刷",   ar: "مستندات وطباعة" },
  "inv.int.cat.safety_equipment":    { en: "Safety & Facility",    zh: "安全与设施",    ar: "السلامة والمرافق" },
  "inv.int.cat.internal_asset":      { en: "Internal Assets",      zh: "内部资产",     ar: "الأصول الداخلية" },
};

/* Icon per category. All names verified against RrIcon's catalogue. */
const CATEGORY_ICON: Record<string, RrIconName> = {
  office_supply:       "clipboard",
  marketing_material:  "megaphone",
  exhibition_material: "building",
  employee_item:       "users",
  packaging_material:  "box-open",
  maintenance_item:    "tools",
  it_equipment:        "laptop",
  printed_material:    "file",
  safety_equipment:    "shield-check",
  internal_asset:      "briefcase",
};

interface Warehouse { id: string; code: string; name: string; is_default: boolean }
interface ItemType {
  id: string;
  type_key: string;
  type_name: string;
  icon: IconName;
  is_active: boolean;
  usage_scope?: "product_related" | "internal_use";
  requires_product?: boolean;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function InventoryInternalItemDrawer({ onClose, onSuccess }: Props) {
  const { t } = useTranslation(T);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState<InternalCategoryHint | null>(null);
  const [subcategory, setSubcategory] = useState<string>("");
  const [customMode, setCustomMode] = useState(false);

  /* Step-3 form. */
  const [name, setName] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<UnitOfMeasure>("pcs");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Load lookups once. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [wRes, tRes] = await Promise.all([
          fetch("/api/inventory/warehouses", { credentials: "include", cache: "no-store" }),
          fetch("/api/inventory/item-types", { credentials: "include", cache: "no-store" }),
        ]);
        const wJ = await wRes.json();
        const tJ = await tRes.json();
        if (cancelled) return;
        const wh = (wJ.warehouses ?? []) as Warehouse[];
        setWarehouses(wh);
        setWarehouseId(wh.find((w) => w.is_default)?.id ?? wh[0]?.id ?? "");
        setTypes((tJ.types ?? []) as ItemType[]);
      } catch {
        /* lookups are best-effort; submit will surface its own error. */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    if (!name.trim()) { setError(t("inv.int.err.name")); return; }
    if (!category) { setStep(1); return; }
    const numQty = Number(qty) || 0;
    if (numQty > 0 && !warehouseId) { setError(t("inv.int.err.warehouse")); return; }
    setSubmitting(true);
    setError(null);
    try {
      /* Resolve the matching item_type_id from the loaded type list. */
      const typeRow = types.find((tt) => tt.type_key === category.type_key && tt.is_active);
      const payload: Record<string, unknown> = {
        item_name: name.trim(),
        type_key: category.type_key,
        unit_of_measure: unit,
      };
      if (typeRow) payload.item_type_id = typeRow.id;
      if (subcategory.trim()) payload.subcategory = subcategory.trim();
      if (notes.trim()) payload.notes = notes.trim();
      if (numQty > 0) {
        payload.initial_quantity = numQty;
        payload.initial_warehouse_id = warehouseId;
      }
      const r = await fetch("/api/inventory/items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { setError(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const categoryLabel = useMemo(() => {
    if (!category) return "";
    const key = `inv.int.cat.${category.type_key}`;
    const translated = t(key);
    return translated === key ? category.label : translated;
  }, [category, t]);

  return (
    <div
      className="fixed inset-0 z-[120] flex justify-end bg-black/60"
      onClick={onClose}
      data-testid="inv-internal-drawer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col border-l border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] sm:max-w-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <RrIcon name="briefcase" size={12} />
            </span>
            <h2 className="text-[14px] font-semibold">{t("inv.int.title")}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("inv.int.close")}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="cross" size={12} />
          </button>
        </div>

        {/* Body — switches by step */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 sm:pb-4">
          {step === 1 && <Step1 t={t} onPick={(c) => { setCategory(c); setSubcategory(""); setCustomMode(false); setStep(2); }} />}

          {step === 2 && category && (
            <Step2
              t={t}
              category={category}
              categoryLabel={categoryLabel}
              customMode={customMode}
              subcategory={subcategory}
              setSubcategory={setSubcategory}
              setCustomMode={setCustomMode}
              onBack={() => setStep(1)}
              onPick={(s) => { setSubcategory(s); setStep(3); }}
            />
          )}

          {step === 3 && category && (
            <Step3
              t={t}
              category={category}
              categoryLabel={categoryLabel}
              subcategory={subcategory}
              warehouses={warehouses}
              name={name} setName={setName}
              warehouseId={warehouseId} setWarehouseId={setWarehouseId}
              qty={qty} setQty={setQty}
              unit={unit} setUnit={setUnit}
              notes={notes} setNotes={setNotes}
              notesOpen={notesOpen} setNotesOpen={setNotesOpen}
              error={error}
              onBack={() => setStep(2)}
            />
          )}
        </div>

        {/* Footer — primary action sticky on mobile (fixed-bottom feel via bg) */}
        {step === 3 && (
          <div className="sticky bottom-0 border-t border-[var(--border-color)] bg-[var(--bg-primary)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              >
                {t("inv.int.cancel")}
              </button>
              <button
                onClick={submit}
                disabled={submitting || !name.trim()}
                data-testid="inv-internal-save"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-inverted)] px-4 py-2 text-[12.5px] font-medium text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-50"
              >
                {!submitting && <RrIcon name="check" size={12} />}
                {submitting ? t("inv.int.saving") : t("inv.int.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 1 — category grid ────────────────────────────── */

function Step1({
  t, onPick,
}: { t: (k: string, fallback?: string) => string; onPick: (c: InternalCategoryHint) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-dim)]">{t("inv.int.step1.eyebrow")}</div>
      <h3 className="mt-1 text-[16px] font-semibold tracking-tight">{t("inv.int.step1.title")}</h3>
      <div
        data-testid="inv-internal-cat-grid"
        className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3"
      >
        {INTERNAL_TAXONOMY.map((c) => {
          const key = `inv.int.cat.${c.type_key}`;
          const label = t(key) === key ? c.label : t(key);
          const icon = CATEGORY_ICON[c.type_key] ?? "box";
          return (
            <button
              key={c.type_key}
              type="button"
              onClick={() => onPick(c)}
              data-testid={`inv-internal-cat-${c.type_key}`}
              className="group flex min-h-[112px] flex-col items-start gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3.5 text-left transition-colors hover:bg-[var(--bg-elevated)]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
                <RrIcon name={icon} size={14} />
              </span>
              <div className="text-[13.5px] font-medium leading-tight tracking-tight text-[var(--text-primary)]">{label}</div>
              <div className="text-[11px] leading-snug text-[var(--text-dim)]">{c.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step 2 — subcategory chips ────────────────────────── */

function Step2({
  t, category, categoryLabel, customMode, subcategory, setSubcategory, setCustomMode, onBack, onPick,
}: {
  t: (k: string, fallback?: string) => string;
  category: InternalCategoryHint;
  categoryLabel: string;
  customMode: boolean;
  subcategory: string;
  setSubcategory: (s: string) => void;
  setCustomMode: (b: boolean) => void;
  onBack: () => void;
  onPick: (s: string) => void;
}) {
  const icon = CATEGORY_ICON[category.type_key] ?? "box";
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-dim)]">{t("inv.int.step2.eyebrow")}</div>
        <button
          onClick={onBack}
          aria-label={t("inv.int.back")}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        >
          <RrIcon name="arrow-left" size={12} />
          {t("inv.int.back")}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <RrIcon name={icon} size={14} />
        </span>
        <div>
          <h3 className="text-[16px] font-semibold leading-tight tracking-tight">{categoryLabel}</h3>
          <div className="text-[11px] text-[var(--text-dim)]">{t("inv.int.step2.title")}</div>
        </div>
      </div>

      <div
        data-testid="inv-internal-sub-grid"
        className="mt-4 flex flex-wrap gap-2"
      >
        {category.subcategories.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            {s}
          </button>
        ))}
        {!customMode ? (
          <button
            type="button"
            onClick={() => setCustomMode(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-dashed border-[var(--border-color)] bg-transparent px-4 py-2.5 text-[13px] text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="plus" size={11} />
            {t("inv.int.custom")}
          </button>
        ) : (
          <div className="flex w-full items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
            <input
              autoFocus
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder={t("inv.int.custom.placeholder")}
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]"
            />
            <button
              type="button"
              onClick={() => subcategory.trim() && onPick(subcategory.trim())}
              disabled={!subcategory.trim()}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-inverted)] px-3 text-[12px] font-medium text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-50"
            >
              <RrIcon name="check" size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 3 — details ─────────────────────────────────── */

function Step3({
  t, category, categoryLabel, subcategory, warehouses,
  name, setName, warehouseId, setWarehouseId, qty, setQty, unit, setUnit,
  notes, setNotes, notesOpen, setNotesOpen, error, onBack,
}: {
  t: (k: string, fallback?: string) => string;
  category: InternalCategoryHint;
  categoryLabel: string;
  subcategory: string;
  warehouses: Warehouse[];
  name: string; setName: (s: string) => void;
  warehouseId: string; setWarehouseId: (s: string) => void;
  qty: string; setQty: (s: string) => void;
  unit: UnitOfMeasure; setUnit: (u: UnitOfMeasure) => void;
  notes: string; setNotes: (s: string) => void;
  notesOpen: boolean; setNotesOpen: (b: boolean) => void;
  error: string | null;
  onBack: () => void;
}) {
  const icon = CATEGORY_ICON[category.type_key] ?? "box";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-dim)]">{t("inv.int.step3.eyebrow")}</div>
        <button
          onClick={onBack}
          aria-label={t("inv.int.back")}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        >
          <RrIcon name="arrow-left" size={12} />
          {t("inv.int.back")}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <RrIcon name={icon} size={14} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{categoryLabel}</h3>
          {subcategory && (
            <div className="truncate text-[11.5px] text-[var(--text-dim)]">{subcategory}</div>
          )}
        </div>
      </div>

      <label className="block">
        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.name")} *</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder={t("inv.int.name.ph")}
          className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--text-dim)]"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.warehouse")}</div>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            disabled={warehouses.length === 0}
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-2 text-[13px] disabled:opacity-50"
          >
            {warehouses.length === 0 && <option value="">—</option>}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code}{w.is_default ? " · default" : ""}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.qty")}</div>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] tabular-nums outline-none focus:border-[var(--text-dim)]"
          />
        </label>
      </div>

      <label className="block">
        <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.int.unit")}</div>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as UnitOfMeasure)}
          className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-2 text-[13px] sm:w-44"
        >
          {ALLOWED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </label>

      {Number(qty) > 0 && warehouseId && (
        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[11px] text-[var(--text-dim)]">
          {t("inv.int.opening.note")}
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setNotesOpen(!notesOpen)}
          className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        >
          <span aria-hidden className="text-[13px] leading-none">{notesOpen ? "−" : "+"}</span>
          {notesOpen ? t("inv.int.notes.hide") : t("inv.int.notes.add")}
        </button>
        {notesOpen && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("inv.int.notes.ph")}
            rows={2}
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--text-dim)]"
          />
        )}
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}
