"use client";

/* ---------------------------------------------------------------------------
   ProductStockProfile — INV-H1 Scope 2

   Drop-in section for /products/[id]/edit that lets the operator decide
   whether the product is tracked in inventory, and configures the
   linked inventory_items row (the "Stock Profile").

   - Reads /api/products/[id]/stock-profile to hydrate
   - Writes back via PUT
   - Track in inventory? → yes/no
   - If yes: unit of measure, default warehouse, cost, reorder/min/max
   - i18n: en + zh + ar via useTranslation
   - Hub design tokens only (var(--bg-…)) — no raw greys
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { useTranslation, type Translations } from "@/lib/i18n";
import { useBaseCurrencyOptional } from "@/lib/hooks/useBaseCurrency";
import { humanizeError } from "@/lib/ui/humanize-error";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import WarehouseIcon from "@/components/icons/ui/WarehouseIcon";

const T: Translations = {
  "stock.section_title": { en: "Stock Profile", zh: "库存档案", ar: "ملف المخزون" },
  "stock.section_subtitle": {
    en: "Track this product in inventory and set defaults for stock movements.",
    zh: "在库存中跟踪此产品并设置库存移动默认值。",
    ar: "تتبع هذا المنتج في المخزون وحدد الإعدادات الافتراضية لحركات المخزون.",
  },
  "stock.track_label": { en: "Track in inventory", zh: "跟踪库存", ar: "تتبع في المخزون" },
  "stock.track_on": { en: "Tracked", zh: "已跟踪", ar: "متتبع" },
  "stock.track_off": { en: "Not tracked", zh: "不跟踪", ar: "غير متتبع" },
  "stock.uom": { en: "Unit of measure", zh: "计量单位", ar: "وحدة القياس" },
  "stock.default_warehouse": { en: "Default warehouse", zh: "默认仓库", ar: "المستودع الافتراضي" },
  "stock.cost_price": { en: "Cost price", zh: "成本价格", ar: "سعر التكلفة" },
  "stock.currency": { en: "Currency", zh: "货币", ar: "العملة" },
  "stock.reorder_point": { en: "Reorder point", zh: "再订货点", ar: "نقطة إعادة الطلب" },
  "stock.min_stock": { en: "Min stock", zh: "最低库存", ar: "الحد الأدنى للمخزون" },
  "stock.max_stock": { en: "Max stock", zh: "最高库存", ar: "الحد الأقصى للمخزون" },
  "stock.save": { en: "Save Stock Profile", zh: "保存库存档案", ar: "حفظ ملف المخزون" },
  "stock.saving": { en: "Saving…", zh: "保存中…", ar: "جارٍ الحفظ…" },
  "stock.saved": { en: "Stock profile updated.", zh: "库存档案已更新。", ar: "تم تحديث ملف المخزون." },
  "stock.disable_confirm": {
    en: "Turn off inventory tracking? Existing history is preserved.",
    zh: "关闭库存跟踪？现有历史记录将被保留。",
    ar: "إيقاف تتبع المخزون؟ سيتم الاحتفاظ بالسجل الموجود.",
  },
  "stock.current_qty": { en: "On hand", zh: "在手", ar: "متوفر" },
  "stock.item_code": { en: "Stock code", zh: "库存代码", ar: "رمز المخزون" },
  "stock.no_warehouse": { en: "Tenant default", zh: "租户默认", ar: "افتراضي المستأجر" },
};

interface Warehouse { id: string; code: string; name: string; is_default: boolean }
interface Profile {
  id: string;
  item_code: string;
  unit_of_measure: string;
  default_warehouse_id: string | null;
  cost_price: number | null;
  currency: string | null;
  reorder_point: number | null;
  min_stock: number | null;
  max_stock: number | null;
  status: string;
  track_stock: boolean;
  track_serials?: boolean;
}
interface StockSummary { total_on_hand: number }

const UNITS = ["pcs","set","pair","box","carton","pallet","roll","sheet","meter","cm","mm","kg","gram","liter","ml","bag","bottle","pack","bundle","unit"];

export default function ProductStockProfile({ productId }: { productId: string }) {
  const { t } = useTranslation(T);
  const base = useBaseCurrencyOptional();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stock, setStock] = useState<StockSummary | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const [track, setTrack] = useState(false);
  const [trackSerials, setTrackSerials] = useState(false);
  const [unit, setUnit] = useState("pcs");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [cost, setCost] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [reorder, setReorder] = useState("");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, wRes] = await Promise.all([
        fetch(`/api/products/${productId}/stock-profile`, { credentials: "include", cache: "no-store" }),
        fetch(`/api/inventory/warehouses`, { credentials: "include", cache: "no-store" }),
      ]);
      const pJ = await pRes.json();
      const wJ = await wRes.json();
      const p = (pJ.profile ?? null) as Profile | null;
      setProfile(p);
      setStock((pJ.stock ?? null) as StockSummary | null);
      setWarehouses((wJ.warehouses ?? []) as Warehouse[]);
      if (p) {
        setTrack(p.track_stock !== false && p.status !== "archived");
        setTrackSerials(!!p.track_serials);
        setUnit(p.unit_of_measure ?? "pcs");
        setWarehouseId(p.default_warehouse_id ?? "");
        setCost(p.cost_price != null ? String(p.cost_price) : "");
        setCurrency(p.currency ?? base ?? "USD");
        setReorder(p.reorder_point != null ? String(p.reorder_point) : "");
        setMinStock(p.min_stock != null ? String(p.min_stock) : "");
        setMaxStock(p.max_stock != null ? String(p.max_stock) : "");
      } else {
        setCurrency(base ?? "USD");
      }
    } finally {
      setLoading(false);
    }
  }, [productId, base]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async () => {
    setError(null);
    setFlash(null);
    if (!track && profile && (stock?.total_on_hand ?? 0) > 0) {
      if (!confirm(t("stock.disable_confirm"))) return;
    }
    setSaving(true);
    try {
      const body = track
        ? {
            track_stock: true,
            track_serials: trackSerials,
            unit_of_measure: unit,
            default_warehouse_id: warehouseId || null,
            cost_price: cost === "" ? null : Number(cost),
            currency,
            reorder_point: reorder === "" ? null : Number(reorder),
            min_stock: minStock === "" ? null : Number(minStock),
            max_stock: maxStock === "" ? null : Number(maxStock),
          }
        : { track_stock: false };
      const r = await fetch(`/api/products/${productId}/stock-profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      setFlash(t("stock.saved"));
      await load();
      window.setTimeout(() => setFlash(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [track, trackSerials, profile, stock, t, unit, warehouseId, cost, currency, reorder, minStock, maxStock, productId, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
          <BoxIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--text-primary)]">{t("stock.section_title")}</div>
          <div className="text-[12px] text-[var(--text-dim)] mt-0.5">{t("stock.section_subtitle")}</div>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="text-[12px] text-[var(--text-dim)]">{track ? t("stock.track_on") : t("stock.track_off")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={track}
            onClick={() => setTrack((v) => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              track ? "bg-[var(--accent-primary,#3b82f6)]" : "bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                track ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      {loading ? (
        <div className="text-[12px] text-[var(--text-ghost)] py-4">…</div>
      ) : track ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t("stock.uom")}>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12.5px] text-[var(--text-primary)]"
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label={t("stock.default_warehouse")}>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12.5px] text-[var(--text-primary)]"
            >
              <option value="">{t("stock.no_warehouse")}</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
          </Field>
          <Field label={t("stock.cost_price")}>
            <input
              type="number" min="0" step="0.01" value={cost}
              onChange={(e) => setCost(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12.5px] text-[var(--text-primary)] tabular-nums"
            />
          </Field>
          <Field label={t("stock.currency")}>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12.5px] text-[var(--text-primary)]"
            >
              {["CNY","USD","EUR","GBP","AED","SAR","EGP"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label={t("stock.reorder_point")}>
            <input
              type="number" min="0" step="1" value={reorder}
              onChange={(e) => setReorder(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12.5px] text-[var(--text-primary)] tabular-nums"
            />
          </Field>
          <Field label={t("stock.min_stock")}>
            <input
              type="number" min="0" step="1" value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12.5px] text-[var(--text-primary)] tabular-nums"
            />
          </Field>
          <Field label={t("stock.max_stock")}>
            <input
              type="number" min="0" step="1" value={maxStock}
              onChange={(e) => setMaxStock(e.target.value)}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12.5px] text-[var(--text-primary)] tabular-nums"
            />
          </Field>
          {/* INV-H4B — Track serials toggle. */}
          <div className="md:col-span-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={trackSerials}
              onClick={() => setTrackSerials((v) => !v)}
              className={`mt-0.5 relative h-5 w-9 rounded-full transition-colors ${
                trackSerials ? "bg-[var(--accent-primary,#3b82f6)]" : "bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  trackSerials ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] text-[var(--text-primary)]">Track serial numbers</div>
              <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                Each unit gets a unique serial. Movements require an exact serial match.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[12px] text-[var(--text-dim)] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-3">
          {t("stock.track_off")}
        </div>
      )}

      {profile && (
        <div className="flex flex-wrap gap-3 text-[11.5px] text-[var(--text-dim)]">
          <span className="inline-flex items-center gap-1.5">
            <WarehouseIcon className="h-3.5 w-3.5" />
            {t("stock.item_code")}: <span className="font-mono text-[var(--text-secondary)]">{profile.item_code}</span>
          </span>
          {stock && (
            <span className="inline-flex items-center gap-1.5">
              {t("stock.current_qty")}: <span className="tabular-nums text-[var(--text-secondary)]">{stock.total_on_hand}</span>
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
          {error}
        </div>
      )}
      {flash && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-300">
          {flash}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-strong,var(--bg-surface))] px-3 py-1.5 text-[12px] text-[var(--text-primary)] disabled:opacity-50"
        >
          {saving ? t("stock.saving") : t("stock.save")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.10em] text-[var(--text-ghost)]">{label}</div>
      {children}
    </label>
  );
}
