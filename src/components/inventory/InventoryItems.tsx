"use client";

/* ---------------------------------------------------------------------------
   /inventory/items — Universal Inventory Item master.

   - Items table with type icon badges, code, brand, on-hand, status.
   - Filters: search (debounced), type, status.
   - Quick Add drawer with item name, type, unit, initial qty/warehouse.
   - Advanced details inside the drawer for cost, supplier, reorder
     points, etc.
   - "Manage Types" panel for the tenant-custom types feature.
   - Row click opens a read-only detail drawer with per-warehouse stock
     and an Archive action.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import type { ColorToken, IconName, UnitOfMeasure } from "@/lib/inventory/types";
import { ALLOWED_COLORS, ALLOWED_ICONS, ALLOWED_UNITS } from "@/lib/inventory/types";
import {
  InventoryEmpty,
  Panel,
  StatusBadge,
  TypeChip,
  TypeIcon,
} from "@/components/inventory/InventoryUi";
import RrIcon from "@/components/ui/RrIcon";
import Button from "@/components/ui/Button";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation, type Translations } from "@/lib/i18n";
import Link from "next/link";
/* INV-H5C — taxonomy hints for internal-use items. */
import { suggestSubcategories, INTERNAL_TYPE_KEYS } from "@/lib/inventory/internal-taxonomy";
/* INV-H9 — card-based internal-item picker (replaces dropdown flow). */
import InventoryInternalItemDrawer from "@/components/inventory/InventoryInternalItemDrawer";
import { kxInspectAttrs } from "@/lib/qa/inspector";

const INV_H1_T: Translations = {
  "inv.title":             { en: "Stock Profiles",   zh: "库存档案",       ar: "ملفات المخزون" },
  "inv.subtitle":          { en: "Stock-tracked products + internal-use items (catalogs, uniforms, office supplies).", zh: "按产品跟踪的库存以及内部使用物品（目录、工服、办公用品）。", ar: "المخزون المرتبط بالمنتجات بالإضافة إلى عناصر الاستخدام الداخلي (الكتالوجات، الزي، اللوازم المكتبية)." },
  "inv.add_via_product":   { en: "Create Product with Stock Profile", zh: "创建产品并附库存档案", ar: "إنشاء منتج مع ملف مخزون" },
  "inv.open_products":     { en: "Open Products",    zh: "打开产品库",     ar: "فتح المنتجات" },
  "inv.create_for_existing": { en: "Create Stock Profile for Existing Product", zh: "为现有产品创建库存档案", ar: "إنشاء ملف مخزون لمنتج موجود" },
  "inv.link_existing":     { en: "Link existing item (admin)", zh: "链接现有项目（管理员）", ar: "ربط عنصر موجود (مسؤول)" },
  "inv.add_internal_use":  { en: "Add Internal-Use Stock", zh: "添加内部用品库存", ar: "إضافة مخزون استخدام داخلي" },
  "inv.manage_types":      { en: "Manage Types",     zh: "管理类型",       ar: "إدارة الأنواع" },
  "inv.add":               { en: "Add",              zh: "添加",           ar: "إضافة" },
  /* INV-H5B */
  "inv.badge_internal_use":  { en: "Internal Use",      zh: "内部使用",     ar: "استخدام داخلي" },
  "inv.badge_product_linked":{ en: "Product-linked",    zh: "关联产品",     ar: "مرتبط بمنتج" },
  "inv.usage_label":         { en: "Usage",             zh: "用途",         ar: "الاستخدام" },
  "inv.usage_product":       { en: "Product-related",   zh: "产品相关",     ar: "مرتبط بالمنتجات" },
  "inv.usage_internal":      { en: "Internal use",      zh: "内部使用",     ar: "استخدام داخلي" },
  "inv.usage_product_hint":  { en: "Sellable goods, machines, parts, raw materials. Must link to a Product.", zh: "可销售商品、机器、零件、原材料。必须关联到产品。", ar: "البضائع القابلة للبيع، الآلات، القطع، المواد الخام. يجب الربط بمنتج." },
  "inv.usage_internal_hint": { en: "Catalogs, uniforms, business cards, office supplies, packaging, exhibition materials. No product needed.", zh: "目录、工服、名片、办公用品、包装、展览材料。无需产品。", ar: "الكتالوجات، الزي، بطاقات العمل، اللوازم المكتبية، التغليف، مواد المعارض. لا حاجة لمنتج." },
  "inv.internal_use_helper": { en: "Use this for catalogs, uniforms, business cards, office supplies, packaging, exhibition materials, and consumables.", zh: "用于目录、工服、名片、办公用品、包装、展览材料和消耗品。", ar: "استخدمه للكتالوجات، الزي، بطاقات العمل، اللوازم المكتبية، التغليف، مواد المعارض، والمستهلكات." },
  "inv.product_linked_helper": { en: "This stock profile must be linked to a Product.", zh: "此库存档案必须关联到产品。", ar: "يجب ربط ملف المخزون هذا بمنتج." },
  "inv.examples_label":      { en: "Examples",          zh: "示例",         ar: "أمثلة" },
};

interface ItemRow {
  id: string;
  item_code: string;
  item_name: string;
  brand: string | null;
  unit_of_measure: string;
  status: "active" | "inactive" | "archived";
  type_key: string;
  type_name: string;
  icon: IconName;
  color: ColorToken;
  qty_on_hand: number;
  cost_price: number | null;
  /* Phase O.5 — folded into the items list query. */
  avg_cost: number;
  inventory_value: number;
  /* INV-H1 — product identity overlay. */
  linked_product_id?: string | null;
  product_name?: string | null;
  product_slug?: string | null;
  product_image_url?: string | null;
  product_sku?: string | null;
  /* INV-H5B — usage scope of the type. */
  requires_product?: boolean;
  usage_scope?: "product_related" | "internal_use";
}

interface ItemType {
  id: string;
  tenant_id: string | null;
  type_key: string;
  type_name: string;
  icon: IconName;
  color: ColorToken;
  is_system: boolean;
  is_active: boolean;
  description: string | null;
  /** INV-H5B */
  requires_product?: boolean;
  usage_scope?: "product_related" | "internal_use";
}

interface Warehouse { id: string; code: string; name: string; is_default: boolean }

function fmtQty(n: number) {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
}
function fmtMoney(n: number) {
  return Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InventoryItems() {
  const { t } = useTranslation(INV_H1_T);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  /* Search is local while the user types; we copy it into searchKey
     after a 250ms debounce — load() depends on searchKey, not search,
     so we don't refetch on every keystroke. */
  const [search, setSearch] = useState("");
  const [searchKey, setSearchKey] = useState("");
  const [filterTypeId, setFilterTypeId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"active" | "inactive" | "archived" | "">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  /* INV-H9 — card-based internal-item drawer. */
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);
  const [typesPanelOpen, setTypesPanelOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /* INV-H6 — Type + Status filters hide behind a single "Filters" disclosure.
     Default-collapsed; opens automatically if either filter is non-default. */
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* Debounce search. */
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setSearchKey(search.trim()), 250);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (searchKey) qs.set("q", searchKey);
      if (filterTypeId) qs.set("type_id", filterTypeId);
      if (filterStatus) qs.set("status", filterStatus);
      const [iRes, tRes, wRes] = await Promise.all([
        fetch(`/api/inventory/items?${qs.toString()}`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/inventory/item-types`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/inventory/warehouses`, { credentials: "include", cache: "no-store" }),
      ]);
      const iJ = await iRes.json();
      const tJ = await tRes.json();
      const wJ = await wRes.json();
      if (!iRes.ok) throw new Error(iJ.error ?? `Failed (${iRes.status})`);
      setRows((iJ.items ?? []) as ItemRow[]);
      setTypes((tJ.types ?? []) as ItemType[]);
      setWarehouses((wJ.warehouses ?? []) as Warehouse[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [searchKey, filterTypeId, filterStatus]);

  useEffect(() => { void load(); }, [load]);

  /* Type-id → meta map for the type picker filter chip strip. */
  const typeMap = useMemo(() => {
    const m = new Map<string, ItemType>();
    for (const t of types) m.set(t.id, t);
    return m;
  }, [types]);

  /* Page wrapper + InventoryHeader provided by /app/inventory/layout.tsx. */
  return (
    <div className="space-y-5">
        <div className="relative flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" size="sm" icon="stamp" onClick={() => setTypesPanelOpen(true)}>
            {t("inv.manage_types")}
          </Button>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setAddMenuOpen((v) => !v)}>
            {t("inv.add")}
          </Button>
          {addMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setAddMenuOpen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1.5 shadow-lg">
                <Link
                  href="/products/new"
                  onClick={() => setAddMenuOpen(false)}
                  className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                >
                  <RrIcon name="plus" size={12} />
                  <span>{t("inv.add_via_product")}</span>
                </Link>
                <Link
                  href="/products"
                  onClick={() => setAddMenuOpen(false)}
                  className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                >
                  <RrIcon name="box-open" size={12} />
                  <span>{t("inv.open_products")}</span>
                </Link>
                <Link
                  href="/products?stock_profile=open"
                  onClick={() => setAddMenuOpen(false)}
                  className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                >
                  <RrIcon name="box-circle-check" size={12} />
                  <span>{t("inv.create_for_existing")}</span>
                </Link>
                <button
                  onClick={() => { setAddMenuOpen(false); setInternalDrawerOpen(true); }}
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                >
                  <RrIcon name="briefcase" size={12} />
                  <span>{t("inv.add_internal_use")}</span>
                </button>
                <button
                  onClick={() => { setAddMenuOpen(false); setQuickAddOpen(true); }}
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-[12px] text-[var(--text-dim)] hover:bg-[var(--bg-surface)]"
                >
                  <RrIcon name="tools" size={12} />
                  <span>{t("inv.link_existing")}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        {/* INV-H6 — Calm filter bar: search + "Filters" toggle + count.
              Type / Status dropdowns hide behind the toggle and only
              render when open or non-default. */}
        <Panel className="px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[var(--text-dim)]">
                <RrIcon name="search" size={12} />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, code, brand, SKU…"
                className="w-[260px] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] py-1.5 pl-7 pr-2 text-[12px]"
              />
            </span>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              aria-expanded={filtersOpen}
            >
              Filters {(filterTypeId || filterStatus !== "active") && <span className="rounded-full bg-[var(--bg-elevated)] px-1.5 text-[9.5px]">·</span>}
            </button>
            {filterTypeId && (
              <button
                onClick={() => setFilterTypeId("")}
                className="rounded-md border border-[var(--border-subtle)] bg-transparent px-2 py-1.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              >
                Clear
              </button>
            )}
            <div className="ml-auto text-[11px] text-[var(--text-dim)] tabular-nums">
              {loading ? "…" : `${rows.length} item${rows.length === 1 ? "" : "s"}`}
            </div>
          </div>
          {filtersOpen && (
            <div className="mt-2.5 flex flex-wrap items-end gap-3 border-t border-[var(--border-subtle)] pt-2.5">
              <label className="flex flex-col">
                <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Type</span>
                <select
                  value={filterTypeId}
                  onChange={(e) => setFilterTypeId(e.target.value)}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                >
                  <option value="">All types</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>{t.type_name}{t.is_system ? "" : " · custom"}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col">
                <span className="mb-1 text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">Status</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                  <option value="">All</option>
                </select>
              </label>
            </div>
          )}
        </Panel>

        {/* INV-H5C — Items table polished for operator-first scan:
              image · name (large) · type/subcategory · UoM · on-hand · status.
            Cost / stock value / avg cost moved into the detail drawer
            (chevron column → click row). Row height bumped to py-3.5 / py-4. */}
        <Panel>
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                <th className="px-3 py-2.5 text-left w-[48px]"></th>
                <th className="px-3 py-2.5 text-left">Item</th>
                <th className="px-3 py-2.5 text-left">Type</th>
                <th className="px-3 py-2.5 text-left">UoM</th>
                <th className="px-3 py-2.5 text-right">On hand</th>
                <th className="px-3 py-2.5 text-left">Status</th>
                <th className="px-3 py-2.5 text-right w-[32px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-[11px] text-[var(--text-dim)]">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-0 py-0">
                  <InventoryEmpty
                    icon="box-open"
                    title={searchKey || filterTypeId ? "No items match the current filters" : "No items yet"}
                    hint={searchKey || filterTypeId ? "Try clearing filters or broadening your search." : "Create your first item — machines, parts, packaging, supplies, anything you track."}
                    action={
                      <button
                        onClick={() => setInternalDrawerOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11.5px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                      >
                        <RrIcon name="briefcase" size={11} />
                        {t("inv.add_internal_use")}
                      </button>
                    }
                  />
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    {...kxInspectAttrs({ component: "InventoryItemRow", module: "Inventory", section: "Items", recordId: r.id })}
                    onClick={() => setSelectedId(r.id)}
                    className="cursor-pointer border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-elevated)]"
                  >
                    {/* Image / type icon. Image first when available; type icon chip fallback. */}
                    <td className="px-3 py-3.5 md:py-4">
                      {r.product_image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={r.product_image_url} alt="" className="h-9 w-9 rounded-lg object-cover bg-[var(--bg-surface)]" />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                          <TypeIcon icon={r.icon} color={r.color} size={14} />
                        </span>
                      )}
                    </td>
                    {/* Name — larger than meta. */}
                    <td className="px-3 py-3.5 md:py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-medium text-[var(--text-primary)] truncate">
                          {r.usage_scope === "internal_use" ? r.item_name : (r.product_name ?? r.item_name)}
                        </span>
                        {r.usage_scope === "internal_use" && (
                          <span className="shrink-0 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.06em] text-[var(--text-dim)]">
                            {t("inv.badge_internal_use")}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--text-dim)] truncate">
                        <span className="font-mono">{r.item_code}</span>
                        {r.brand && <> · {r.brand}</>}
                        {r.product_sku && r.product_sku !== r.item_code && <> · {r.product_sku}</>}
                      </div>
                    </td>
                    <td className="px-3 py-3.5 md:py-4">
                      <TypeChip name={r.type_name} icon={r.icon} color={r.color} />
                    </td>
                    <td className="px-3 py-3.5 md:py-4 text-[var(--text-dim)] text-[12px]">{r.unit_of_measure}</td>
                    <td className="px-3 py-3.5 md:py-4 text-right tabular-nums font-mono text-[13px] text-[var(--text-primary)]">
                      {fmtQty(r.qty_on_hand)}
                    </td>
                    <td className="px-3 py-3.5 md:py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-3 py-3.5 md:py-4 text-right text-[12px] text-[var(--text-dim)]">→</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>

      {quickAddOpen && (
        <QuickAddDrawer
          types={types}
          warehouses={warehouses}
          onClose={() => setQuickAddOpen(false)}
          onSuccess={() => { setQuickAddOpen(false); void load(); }}
        />
      )}

      {internalDrawerOpen && (
        <InventoryInternalItemDrawer
          onClose={() => setInternalDrawerOpen(false)}
          onSuccess={() => { setInternalDrawerOpen(false); void load(); }}
        />
      )}

      {typesPanelOpen && (
        <TypesPanel
          types={types}
          onClose={() => setTypesPanelOpen(false)}
          onChanged={() => { void load(); }}
        />
      )}

      {selectedId && (
        <ItemDetailDrawer
          itemId={selectedId}
          typeMap={typeMap}
          onClose={() => setSelectedId(null)}
          onChanged={() => { void load(); }}
        />
      )}
    </div>
  );
}

/* ─── Quick Add drawer ──────────────────────────────────── */

function DrawerShell({
  title, onClose, children, footer,
}: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        /* INV-H5C — full-screen on mobile, side drawer on desktop. */
        className="flex w-full sm:max-w-md flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] border-l border-white/[0.08]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] text-[20px] leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-white/[0.06] px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

function QuickAddDrawer({
  types, warehouses, onClose, onSuccess,
}: {
  types: ItemType[];
  warehouses: Warehouse[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation(INV_H1_T);
  const [itemName, setItemName] = useState("");
  /* INV-H5B — default to office_supply (internal-use) so the drawer
     defaults to the "no product needed" flow; operator can switch. */
  const initialTypeId =
    types.find((tt) => tt.is_active && tt.type_key === "office_supply")?.id ??
    types.find((tt) => tt.is_active && tt.usage_scope === "internal_use")?.id ??
    types.find((tt) => tt.is_active)?.id ?? "";
  const [typeId, setTypeId] = useState(initialTypeId);
  const [unit, setUnit] = useState<UnitOfMeasure>("pcs");
  const [initialQty, setInitialQty] = useState("");
  const initialWh = warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? "";
  const [warehouseId, setWarehouseId] = useState(initialWh);
  const [advanced, setAdvanced] = useState(false);

  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reorderPoint, setReorderPoint] = useState("");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [description, setDescription] = useState("");
  /* INV-H5C — free-text subcategory with taxonomy hints. */
  const [subcategory, setSubcategory] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = types.find((tt) => tt.id === typeId);
  /* INV-H5B — when the selected type is internal-use, the new branch in
     the API guard skips the product requirement entirely (no admin_repair
     stamp needed). Product-related types still need admin_repair on this
     standalone drawer since the canonical path is via Products. */
  const isInternalUse =
    selectedType?.usage_scope === "internal_use" ||
    selectedType?.requires_product === false ||
    (selectedType ? INTERNAL_TYPE_KEYS.has(selectedType.type_key) : false);
  const subcategorySuggestions = isInternalUse && selectedType
    ? suggestSubcategories(selectedType.type_key)
    : [];

  const submit = async () => {
    if (!itemName.trim()) { setError("Item name required"); return; }
    if (!typeId) { setError("Type required"); return; }
    if (Number(initialQty) > 0 && !warehouseId) {
      setError("Initial quantity needs a destination warehouse");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        item_name: itemName.trim(),
        item_type_id: typeId,
        unit_of_measure: unit,
      };
      if (!isInternalUse) {
        /* Product-related types still go through the admin_repair path on
           this drawer; canonical creation is via Products. */
        payload.admin_repair = true;
      }
      if (initialQty) {
        payload.initial_quantity = Number(initialQty) || 0;
        payload.initial_warehouse_id = warehouseId || null;
      }
      /* INV-H5C — subcategory + notes always flow through, regardless of
         the Advanced section. Subcategory is the new core "what kind of
         X is this?" field for internal items. */
      if (subcategory.trim()) payload.subcategory = subcategory.trim();
      if (notes.trim()) payload.notes = notes.trim();
      if (advanced) {
        if (brand) payload.brand = brand;
        if (sku) payload.sku = sku;
        if (barcode) payload.barcode = barcode;
        if (costPrice) payload.cost_price = Number(costPrice) || 0;
        if (currency) payload.currency = currency;
        if (reorderPoint) payload.reorder_point = Number(reorderPoint);
        if (minStock) payload.min_stock = Number(minStock);
        if (maxStock) payload.max_stock = Number(maxStock);
        if (description) payload.description = description;
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

  return (
    <DrawerShell
      title="Add Inventory Item"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50"
          >
            {!submitting && <RrIcon name="check" size={12} />}
            {submitting ? "Saving…" : "Create Item"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Item Name *</div>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            autoFocus
            placeholder="e.g. Lockstitch Machine LX-9000"
            className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
          />
        </label>
        <label className="block">
          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-gray-500">
            <span>Type *</span>
            {selectedType && <TypeChip name={selectedType.type_name} icon={selectedType.icon} color={selectedType.color} compact />}
          </div>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
          >
            <optgroup label="Internal use (no product needed)">
              {types.filter((tt) => tt.is_active && (tt.usage_scope === "internal_use" || tt.requires_product === false)).map((tt) => (
                <option key={tt.id} value={tt.id}>{tt.type_name}{tt.is_system ? "" : " · custom"}</option>
              ))}
            </optgroup>
            <optgroup label="Product-related (requires Product link)">
              {types.filter((tt) => tt.is_active && tt.usage_scope !== "internal_use" && tt.requires_product !== false).map((tt) => (
                <option key={tt.id} value={tt.id}>{tt.type_name}{tt.is_system ? "" : " · custom"}</option>
              ))}
            </optgroup>
          </select>
        </label>

        {/* INV-H5B — Branch on usage scope. */}
        {selectedType && (
          isInternalUse ? (
            <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-primary)]">
                  {t("inv.badge_internal_use")}
                </span>
                <span className="text-[10.5px] text-[var(--text-dim)]">— Not linked to Product</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--text-dim)]">{t("inv.internal_use_helper")}</p>
              <div className="text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">{t("inv.examples_label")}</div>
              <div className="flex flex-wrap gap-1.5">
                {["Catalogs","Uniforms","Business cards","Office supplies","Packaging boxes","Exhibition banners"].map((ex) => (
                  <span key={ex} className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-0.5 text-[10.5px] text-[var(--text-dim)]">{ex}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[11px] text-[var(--text-dim)]">
              <span className="mr-1 inline-block rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-primary)]">
                {t("inv.badge_product_linked")}
              </span>
              {t("inv.product_linked_helper")}
            </div>
          )
        )}
        {/* INV-H5C — Subcategory autocomplete. Only shown for internal-use
            items where the taxonomy file has hints. Optional, free-text. */}
        {isInternalUse && subcategorySuggestions.length > 0 && (
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">
              Subcategory <span className="text-gray-600 normal-case tracking-normal">(optional)</span>
            </div>
            <input
              list={`subcat-${selectedType?.type_key ?? "all"}`}
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder={`e.g. ${subcategorySuggestions[0]}`}
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            />
            <datalist id={`subcat-${selectedType?.type_key ?? "all"}`}>
              {subcategorySuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
        )}

        <label className="block">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Unit of Measure</div>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as UnitOfMeasure)}
            className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
          >
            {ALLOWED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Initial Qty (optional)</div>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={initialQty}
              onChange={(e) => setInitialQty(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Warehouse</div>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              disabled={warehouses.length === 0}
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] disabled:opacity-50"
            >
              {warehouses.length === 0 && <option value="">—</option>}
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code}{w.is_default ? " · default" : ""}</option>
              ))}
            </select>
          </label>
        </div>
        {Number(initialQty) > 0 && (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1.5 text-[10.5px] text-emerald-200/90">
            An opening-balance movement of {initialQty} {unit} will be posted automatically.
          </div>
        )}

        {/* INV-H5C — Notes collapse (default closed for internal-use). */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setNotesOpen((s) => !s)}
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200"
          >
            <span aria-hidden>{notesOpen ? "−" : "+"}</span>
            {notesOpen ? "Hide notes" : "Add notes (optional)"}
          </button>
          {notesOpen && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the next person should know about this item…"
              rows={2}
              className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
            />
          )}
        </div>

        <button
          onClick={() => setAdvanced((s) => !s)}
          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200"
        >
          <span aria-hidden>{advanced ? "−" : "+"}</span>
          {isInternalUse
            ? (advanced ? "Hide advanced details" : "Advanced (cost, reorder point, supplier)")
            : (advanced ? "Hide advanced details" : "Advanced details (brand, SKU, cost, thresholds)")}
        </button>

        {advanced && (
          <div className="space-y-3 rounded-md border border-white/[0.06] p-3">
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Brand"        value={brand}        onChange={(e) => setBrand(e.target.value)}        className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
              <input placeholder="SKU"          value={sku}          onChange={(e) => setSku(e.target.value)}          className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
              <input placeholder="Barcode"      value={barcode}      onChange={(e) => setBarcode(e.target.value)}      className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
              <input placeholder="Currency"     value={currency}     onChange={(e) => setCurrency(e.target.value)}     className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
              <input type="number" placeholder="Cost price"    value={costPrice}    onChange={(e) => setCostPrice(e.target.value)}    className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
              <input type="number" placeholder="Reorder point" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
              <input type="number" placeholder="Min stock"     value={minStock}     onChange={(e) => setMinStock(e.target.value)}     className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
              <input type="number" placeholder="Max stock"     value={maxStock}     onChange={(e) => setMaxStock(e.target.value)}     className="rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px] tabular-nums" />
            </div>
            <textarea placeholder="Description / notes" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>
        )}
      </div>
    </DrawerShell>
  );
}

/* ─── Item detail drawer ─────────────────────────────────── */

interface DetailItem {
  id: string;
  item_code: string;
  item_name: string;
  item_type_id: string;
  brand: string | null;
  sku: string | null;
  barcode: string | null;
  qr_code: string | null;
  unit_of_measure: string;
  cost_price: number | null;
  currency: string | null;
  min_stock: number | null;
  reorder_point: number | null;
  max_stock: number | null;
  is_consumable: boolean;
  is_sellable: boolean;
  is_purchasable: boolean;
  track_stock: boolean;
  description: string | null;
  notes: string | null;
  status: "active" | "inactive" | "archived";
  linked_product_id: string | null;
  created_at: string;
  updated_at: string;
}
interface DetailStockBucket {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
}
interface DetailStock {
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  warehouses: DetailStockBucket[];
}
interface DetailValuationLocation {
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  qty_on_hand: number;
  average_cost: number;
  inventory_value: number;
}
interface DetailValuation {
  total_qty: number;
  total_value: number;
  weighted_avg_cost: number;
  last_in_cost: number | null;
  currency: string;
  locations: DetailValuationLocation[];
}

function ItemDetailDrawer({
  itemId, typeMap, onClose, onChanged,
}: {
  itemId: string;
  typeMap: Map<string, ItemType>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [item, setItem] = useState<DetailItem | null>(null);
  const [stock, setStock] = useState<DetailStock | null>(null);
  const [valuation, setValuation] = useState<DetailValuation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [r, vRes] = await Promise.all([
          fetch(`/api/inventory/items/${itemId}`, { credentials: "include", cache: "no-store" }),
          fetch(`/api/inventory/items/${itemId}/valuation`, { credentials: "include", cache: "no-store" }),
        ]);
        const j = await r.json();
        const vJ = await vRes.json();
        if (cancelled) return;
        if (!r.ok) { setError(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
        setItem(j.item as DetailItem);
        setStock(j.stock as DetailStock);
        if (vRes.ok && vJ.valuation) setValuation(vJ.valuation as DetailValuation);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [itemId]);

  const archive = async () => {
    if (!item) return;
    if (!confirm(`Archive ${item.item_code} — ${item.item_name}? It will stop showing in active pickers.`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/inventory/items/${itemId}`, { method: "DELETE", credentials: "include" });
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? "Archive failed"); return; }
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/inventory/items/${itemId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const j = await r.json();
      if (!r.ok) { alert(j.error ?? "Restore failed"); return; }
      onChanged();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const type = item ? typeMap.get(item.item_type_id) : null;

  return (
    <DrawerShell
      title="Inventory Item"
      onClose={onClose}
      footer={
        item ? (
          <div className="flex justify-between gap-2">
            {item.status === "archived" ? (
              <button onClick={restore} disabled={busy} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[12px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">
                Restore
              </button>
            ) : (
              <button onClick={archive} disabled={busy} className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[12px] text-rose-300 hover:bg-rose-500/20 disabled:opacity-50">
                <RrIcon name="trash" size={12} /> Archive
              </button>
            )}
            <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">
              Close
            </button>
          </div>
        ) : null
      }
    >
      {loading && <div className="text-[12px] text-[var(--text-dim)]">Loading…</div>}
      {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</div>}
      {item && (
        <div className="space-y-4">
          <div>
            <div className="font-mono text-[11px] text-gray-500">{item.item_code}</div>
            <div className="mt-1 text-[16px] font-medium tracking-tight">{item.item_name}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {type && <TypeChip name={type.type_name} icon={type.icon} color={type.color} />}
              <StatusBadge status={item.status} />
              {item.is_consumable && <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] text-amber-200">Consumable</span>}
              {item.is_sellable && <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] text-emerald-200">Sellable</span>}
            </div>
          </div>

          {/* Stock summary */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Stock</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2">
                <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">On hand</div>
                <div className="mt-0.5 text-[16px] tabular-nums font-mono">{fmtQty(stock?.total_on_hand ?? 0)}</div>
              </div>
              <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2">
                <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">Reserved</div>
                <div className="mt-0.5 text-[16px] tabular-nums font-mono text-gray-300">{fmtQty(stock?.total_reserved ?? 0)}</div>
              </div>
              <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2">
                <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">Available</div>
                <div className="mt-0.5 text-[16px] tabular-nums font-mono">{fmtQty(stock?.total_available ?? 0)}</div>
              </div>
            </div>
            {(stock?.warehouses?.length ?? 0) > 0 && (
              <div className="mt-3 overflow-hidden rounded-md border border-white/[0.05]">
                <table className="min-w-full text-[11.5px]">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                      <th className="px-2 py-1.5 text-left">Location</th>
                      <th className="px-2 py-1.5 text-right">On hand</th>
                      <th className="px-2 py-1.5 text-right">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock!.warehouses.map((w) => (
                      <tr key={w.warehouse_id} className="border-b border-white/[0.03] last:border-b-0">
                        <td className="px-2 py-1.5 text-gray-300">{w.warehouse_code} <span className="text-gray-500">· {w.warehouse_name}</span></td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono">{fmtQty(w.qty_on_hand)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-mono text-gray-400">{fmtQty(w.qty_available)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Valuation — Phase O.5 */}
          {valuation && valuation.total_qty > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Valuation</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2">
                  <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">Avg cost</div>
                  <div className="mt-0.5 text-[15px] tabular-nums font-mono">{fmtMoney(valuation.weighted_avg_cost)}</div>
                  <div className="mt-0.5 text-[10px] text-gray-500">{valuation.currency}</div>
                </div>
                <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2">
                  <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">Stock value</div>
                  <div className="mt-0.5 text-[15px] tabular-nums font-mono text-emerald-200">{fmtMoney(valuation.total_value)}</div>
                  <div className="mt-0.5 text-[10px] text-gray-500">{valuation.currency}</div>
                </div>
                <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2">
                  <div className="text-[9.5px] uppercase tracking-[0.10em] text-gray-500">Last in cost</div>
                  <div className="mt-0.5 text-[15px] tabular-nums font-mono text-gray-300">
                    {valuation.last_in_cost != null ? fmtMoney(valuation.last_in_cost) : "—"}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-500">{valuation.currency}</div>
                </div>
              </div>
              {valuation.locations.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-md border border-white/[0.05]">
                  <table className="min-w-full text-[11.5px]">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                        <th className="px-2 py-1.5 text-left">Location</th>
                        <th className="px-2 py-1.5 text-right">Qty</th>
                        <th className="px-2 py-1.5 text-right">Avg cost</th>
                        <th className="px-2 py-1.5 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valuation.locations.map((l) => (
                        <tr key={l.warehouse_id} className="border-b border-white/[0.03] last:border-b-0">
                          <td className="px-2 py-1.5 text-gray-300">{l.warehouse_code} <span className="text-gray-500">· {l.warehouse_name}</span></td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-mono">{fmtQty(l.qty_on_hand)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-mono text-gray-400">{fmtMoney(l.average_cost)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums font-mono">{fmtMoney(l.inventory_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* INV-H4A — Variants section */}
          <ItemVariantsSection itemId={itemId} />

          {/* Details grid */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">Details</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
              <DT label="Unit"        value={item.unit_of_measure} />
              <DT label="Brand"       value={item.brand ?? "—"} />
              <DT label="SKU"         value={item.sku ?? "—"} />
              <DT label="Barcode"     value={item.barcode ?? "—"} />
              <DT label="Cost"        value={item.cost_price != null ? `${Number(item.cost_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.currency ?? ""}` : "—"} />
              <DT label="Reorder"     value={item.reorder_point != null ? fmtQty(item.reorder_point) : "—"} />
              <DT label="Min stock"   value={item.min_stock != null ? fmtQty(item.min_stock) : "—"} />
              <DT label="Max stock"   value={item.max_stock != null ? fmtQty(item.max_stock) : "—"} />
              <DT label="Linked product" value={item.linked_product_id ? "Yes" : "—"} />
              <DT label="Track stock" value={item.track_stock ? "Yes" : "No"} />
            </dl>
          </div>

          {(item.description || item.notes) && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-1">Description</div>
              <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-2 text-[11.5px] text-gray-300 whitespace-pre-wrap">
                {item.description || item.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </DrawerShell>
  );
}

function DT({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-200 tabular-nums">{value}</dd>
    </>
  );
}

/* ─── Types Panel ──────────────────────────────────────── */

function TypesPanel({
  types, onClose, onChanged,
}: {
  types: ItemType[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation(INV_H1_T);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconName>("box");
  const [color, setColor] = useState<ColorToken>("slate");
  const [description, setDescription] = useState("");
  /* INV-H5B — usage scope picker for custom types (default internal_use). */
  const [usageScope, setUsageScope] = useState<"product_related" | "internal_use">("internal_use");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return types.slice().sort((a, b) => (a.is_system === b.is_system ? a.type_name.localeCompare(b.type_name) : a.is_system ? -1 : 1));
  }, [types]);

  const submit = async () => {
    if (!name.trim()) { setError("Type name required"); return; }
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/inventory/item-types", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type_name: name.trim(),
          icon, color,
          description: description || null,
          usage_scope: usageScope,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
      setName(""); setDescription("");
      onChanged();
    } finally {
      setSubmitting(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm("Archive this custom type? Items already using it keep their reference.")) return;
    const r = await fetch(`/api/inventory/item-types/${id}`, { method: "DELETE", credentials: "include" });
    const j = await r.json();
    if (!r.ok) { alert(humanizeError(j.error ?? `HTTP ${r.status}`)); return; }
    onChanged();
  };

  return (
    <DrawerShell title="Item Types" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-md border border-white/[0.06] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">New custom type</div>
            <TypeChip name={name || "Preview"} icon={icon} color={color} compact />
          </div>
          <input
            placeholder="e.g. CEO Office Items, Exhibition Screens…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[11px]">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Icon</div>
              <select value={icon} onChange={(e) => setIcon(e.target.value as IconName)} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]">
                {ALLOWED_ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </label>
            <label className="block text-[11px]">
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-gray-500">Color</div>
              <select value={color} onChange={(e) => setColor(e.target.value as ColorToken)} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]">
                {ALLOWED_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <textarea placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-md border border-white/[0.06] bg-[var(--bg-primary)] px-2 py-1.5 text-[12px]" />

          {/* INV-H5B — Usage scope */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-dim)]">{t("inv.usage_label")}</div>
            <div className="grid grid-cols-1 gap-1.5">
              <label className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-[11.5px] ${usageScope === "internal_use" ? "border-[var(--text-primary)] bg-[var(--bg-surface)]" : "border-[var(--border-color)]"}`}>
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={usageScope === "internal_use"}
                  onChange={() => setUsageScope("internal_use")}
                />
                <span className="flex-1">
                  <span className="block text-[12px] font-medium text-[var(--text-primary)]">{t("inv.usage_internal")}</span>
                  <span className="block text-[10.5px] leading-relaxed text-[var(--text-dim)]">{t("inv.usage_internal_hint")}</span>
                </span>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-[11.5px] ${usageScope === "product_related" ? "border-[var(--text-primary)] bg-[var(--bg-surface)]" : "border-[var(--border-color)]"}`}>
                <input
                  type="radio"
                  className="mt-0.5"
                  checked={usageScope === "product_related"}
                  onChange={() => setUsageScope("product_related")}
                />
                <span className="flex-1">
                  <span className="block text-[12px] font-medium text-[var(--text-primary)]">{t("inv.usage_product")}</span>
                  <span className="block text-[10.5px] leading-relaxed text-[var(--text-dim)]">{t("inv.usage_product_hint")}</span>
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>
          )}
          <button onClick={submit} disabled={submitting} className="w-full rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">
            {submitting ? "Creating…" : "Create custom type"}
          </button>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500 mb-2">All types ({sorted.length})</div>
          <ul className="space-y-1">
            {sorted.map((tt) => (
              <li key={tt.id} className="flex items-center justify-between rounded-md border border-white/[0.04] px-2 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <TypeIcon icon={tt.icon} color={tt.color} />
                  <span className="text-[12px] text-gray-200 truncate">{tt.type_name}</span>
                  <span className="shrink-0 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.06em] text-[var(--text-dim)]">
                    {tt.usage_scope === "internal_use" || tt.requires_product === false ? t("inv.badge_internal_use") : t("inv.badge_product_linked")}
                  </span>
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {tt.is_system ? "system" : "custom"}{!tt.is_active ? " · archived" : ""}
                  </span>
                </div>
                {!tt.is_system && tt.is_active && (
                  <button onClick={() => archive(tt.id)} className="shrink-0 text-[11px] text-rose-300 hover:text-rose-200">Archive</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DrawerShell>
  );
}

/* ─── INV-H4A — Variants section inside item detail ──────────── */

interface VariantDto {
  id: string;
  variant_code: string;
  variant_name: string;
  attributes: Record<string, unknown>;
  cost_price: number | null;
  status: "active" | "inactive" | "archived";
}

function ItemVariantsSection({ itemId }: { itemId: string }) {
  const [variants, setVariants] = useState<VariantDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColorAttr] = useState("");
  const [voltage, setVoltage] = useState("");
  const [size, setSize] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/inventory/variants?item_id=${itemId}&limit=200`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) {
        setError(humanizeError(j.error ?? r.statusText));
        return;
      }
      setVariants((j.variants ?? []) as VariantDto[]);
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const attrs: Record<string, string> = {};
      if (color) attrs.color = color;
      if (voltage) attrs.voltage = voltage;
      if (size) attrs.size = size;
      const r = await fetch("/api/inventory/variants", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_item_id: itemId,
          variant_name: name,
          attributes: attrs,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(humanizeError(j.error ?? r.statusText));
        return;
      }
      setName("");
      setColorAttr("");
      setVoltage("");
      setSize("");
      setAddOpen(false);
      void load();
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function archive(id: string) {
    if (!confirm("Archive this variant?")) return;
    await fetch(`/api/inventory/variants/${id}`, { method: "DELETE", credentials: "include" });
    void load();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.12em] text-gray-500">Variants</div>
        <button
          type="button"
          onClick={() => setAddOpen((s) => !s)}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          <RrIcon name="plus" size={10} />
          Add variant
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}

      {addOpen && (
        <div className="mb-3 rounded-md border border-white/[0.05] bg-white/[0.012] p-3 dark:border-white/[0.05]">
          <div className="grid grid-cols-2 gap-2 text-[11.5px]">
            <label className="col-span-2 block">
              <div className="mb-0.5 text-[10px] uppercase tracking-[0.10em] text-gray-500">Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Black 220V Large"
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px] text-[var(--text-primary)]"
              />
            </label>
            <label className="block">
              <div className="mb-0.5 text-[10px] uppercase tracking-[0.10em] text-gray-500">Color</div>
              <input
                value={color}
                onChange={(e) => setColorAttr(e.target.value)}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px] text-[var(--text-primary)]"
              />
            </label>
            <label className="block">
              <div className="mb-0.5 text-[10px] uppercase tracking-[0.10em] text-gray-500">Voltage</div>
              <input
                value={voltage}
                onChange={(e) => setVoltage(e.target.value)}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px] text-[var(--text-primary)]"
              />
            </label>
            <label className="col-span-2 block">
              <div className="mb-0.5 text-[10px] uppercase tracking-[0.10em] text-gray-500">Size</div>
              <input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11.5px] text-[var(--text-primary)]"
              />
            </label>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !name.trim()}
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-700 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-200"
            >
              {submitting ? "…" : "Save variant"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[11px] text-gray-500">Loading…</div>
      ) : variants.length === 0 ? (
        <div className="rounded-md border border-white/[0.05] bg-white/[0.012] px-3 py-3 text-[11.5px] text-gray-500">
          No variants yet. Add a variant when this item exists in multiple flavours (color, voltage, size).
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-white/[0.05]">
          <table className="min-w-full text-[11.5px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-[0.10em] text-gray-500">
                <th className="px-2 py-1.5 text-left">Name</th>
                <th className="px-2 py-1.5 text-left">Attributes</th>
                <th className="px-2 py-1.5 text-right">Cost</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={v.id} className="border-b border-white/[0.03] last:border-b-0">
                  <td className="px-2 py-1.5 text-gray-300">
                    <div>{v.variant_name}</div>
                    <div className="font-mono text-[10px] text-gray-500">{v.variant_code}</div>
                  </td>
                  <td className="px-2 py-1.5 text-gray-400">
                    {Object.entries(v.attributes ?? {})
                      .map(([k, val]) => `${k}: ${String(val)}`)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-mono text-gray-400">
                    {v.cost_price != null
                      ? Number(v.cost_price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <StatusBadge status={v.status} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {v.status !== "archived" && (
                      <button
                        type="button"
                        onClick={() => archive(v.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-700 hover:bg-rose-500/20 dark:text-rose-200"
                      >
                        <RrIcon name="trash" size={10} /> Archive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
