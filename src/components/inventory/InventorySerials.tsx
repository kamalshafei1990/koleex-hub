"use client";

/* ---------------------------------------------------------------------------
   /inventory/serials — list + filter serials.

   Phase INV-H4B. Visibility-only. Status mutation happens through
   movements (sales_shipment, transfer, return, adjustment) and through
   /api/inventory/serials/[id] PATCH for condition_status/notes only.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import RrIcon from "@/components/ui/RrIcon";
import { InventoryEmpty, Panel } from "@/components/inventory/InventoryUi";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";
import { kxInspectAttrs } from "@/lib/qa/inspector";

type SerialStatus = "in_stock" | "reserved" | "sold" | "returned" | "damaged" | "scrapped" | "in_transit";
type SerialCondition = "new" | "opened" | "refurbished" | "damaged";

interface SerialRow {
  id: string;
  serial_no: string;
  inventory_item_id: string;
  variant_id: string | null;
  batch_id: string | null;
  warehouse_id: string | null;
  status: SerialStatus;
  condition_status: SerialCondition | null;
  customer_id: string | null;
  supplier_id: string | null;
  current_movement_id: string | null;
  purchase_date: string | null;
  sold_date: string | null;
  updated_at: string;
  item_code: string | null;
  item_name: string | null;
  variant_name: string | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
  customer_name: string | null;
  supplier_name: string | null;
}

interface Warehouse { id: string; code: string; name: string }
interface ItemRow { id: string; item_code: string; item_name: string; track_serials?: boolean }

const STATUS_TABS: Array<SerialStatus | "all"> = [
  "all",
  "in_stock",
  "in_transit",
  "sold",
  "returned",
  "damaged",
  "scrapped",
];

function statusClasses(s: SerialStatus): string {
  switch (s) {
    case "in_stock":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    case "in_transit":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200";
    case "sold":
      return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200";
    case "returned":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
    case "damaged":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-200";
    case "scrapped":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200";
    case "reserved":
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200";
  }
}

function fmtTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - d);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function InventorySerials() {
  const { t } = useTranslation(inventoryT);

  const [serials, setSerials] = useState<SerialRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [tab, setTab] = useState<SerialStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterItem, setFilterItem] = useState<string>("");
  const [filterWarehouse, setFilterWarehouse] = useState<string>("");
  const [filterCondition, setFilterCondition] = useState<SerialCondition | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Debounce search by 250ms. */
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("status", tab);
      if (filterItem) params.set("item_id", filterItem);
      if (filterWarehouse) params.set("warehouse_id", filterWarehouse);
      if (filterCondition) params.set("condition", filterCondition);
      if (debouncedSearch) params.set("q", debouncedSearch);
      params.set("limit", "300");
      const [sRes, wRes, iRes] = await Promise.all([
        fetch(`/api/inventory/serials?${params.toString()}`).then((r) => r.json()),
        fetch(`/api/inventory/warehouses`).then((r) => r.json()),
        fetch(`/api/inventory/items?limit=500`).then((r) => r.json()),
      ]);
      if (sRes.error) throw new Error(sRes.error);
      setSerials((sRes.serials ?? []) as SerialRow[]);
      setWarehouses((wRes.warehouses ?? []) as Warehouse[]);
      setItems((iRes.items ?? []) as ItemRow[]);
    } catch (e) {
      setError(humanizeError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [tab, filterItem, filterWarehouse, filterCondition, debouncedSearch]);

  useEffect(() => { void load(); }, [load]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: serials.length };
    for (const s of serials) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return counts;
  }, [serials]);

  /* Page wrapper + InventoryHeader provided by /app/inventory/layout.tsx. */
  return (
    <div className="space-y-5">
      {/* Filters bar */}
      <Panel className="mt-5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]">
              <RrIcon name="search" size={12} />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("inv.serials.search.placeholder", "Search serial number…")}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 pl-7 pr-2 text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)]"
            />
          </div>
          <select
            value={filterItem}
            onChange={(e) => setFilterItem(e.target.value)}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12px] text-[var(--text-primary)]"
          >
            <option value="">{t("inv.serials.filter.item.all", "All items")}</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.item_code} — {i.item_name}
              </option>
            ))}
          </select>
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12px] text-[var(--text-primary)]"
          >
            <option value="">{t("inv.serials.filter.warehouse.all", "All warehouses")}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
            ))}
          </select>
          <select
            value={filterCondition}
            onChange={(e) => setFilterCondition(e.target.value as SerialCondition | "")}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12px] text-[var(--text-primary)]"
          >
            <option value="">{t("inv.serials.filter.condition.all", "Any condition")}</option>
            <option value="new">{t("inv.serials.condition.new", "New")}</option>
            <option value="opened">{t("inv.serials.condition.opened", "Opened")}</option>
            <option value="refurbished">{t("inv.serials.condition.refurbished", "Refurbished")}</option>
            <option value="damaged">{t("inv.serials.condition.damaged", "Damaged")}</option>
          </select>
        </div>
      </Panel>

      {/* Status tabs */}
      <div className="mt-4 flex flex-wrap items-center gap-1">
        {STATUS_TABS.map((s) => {
          const active = s === tab;
          const count = tabCounts[s] ?? 0;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] transition-colors ${
                active
                  ? "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-dim)] hover:border-[var(--border-subtle)] hover:text-[var(--text-primary)]"
              }`}
            >
              {t(`inv.serials.tab.${s}`, s === "all" ? "All" : s.replace("_", " "))}
              <span className="rounded bg-[var(--bg-surface-elevated)] px-1 text-[10px] text-[var(--text-dim)]">{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Table */}
      <Panel className="mt-4">
        {loading ? (
          <div className="px-4 py-8 text-center text-[12px] text-[var(--text-dim)]">{t("inv.loading", "Loading…")}</div>
        ) : serials.length === 0 ? (
          <InventoryEmpty
            icon="fingerprint"
            title={t("inv.serials.empty.title", "No serials yet")}
            hint={t(
              "inv.serials.empty.description",
              "Turn on serial tracking on a product, then receive stock to register serials.",
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] uppercase tracking-wide text-[var(--text-dim)]">
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="px-3 py-2">{t("inv.serials.col.serial", "Serial")}</th>
                  <th className="px-3 py-2">{t("inv.serials.col.item", "Item")}</th>
                  <th className="px-3 py-2">{t("inv.serials.col.variant", "Variant")}</th>
                  <th className="px-3 py-2">{t("inv.serials.col.warehouse", "Warehouse")}</th>
                  <th className="px-3 py-2">{t("inv.serials.col.status", "Status")}</th>
                  <th className="px-3 py-2">{t("inv.serials.col.condition", "Condition")}</th>
                  <th className="px-3 py-2">{t("inv.serials.col.party", "Customer / Supplier")}</th>
                  <th className="px-3 py-2 text-right">{t("inv.serials.col.updated", "Last activity")}</th>
                </tr>
              </thead>
              <tbody>
                {serials.map((s) => (
                  <tr key={s.id} {...kxInspectAttrs({ component: "InventorySerialRow", module: "Inventory", section: "Serials", recordId: s.id })} className="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]">
                    <td className="px-3 py-2 font-mono text-[12px] text-[var(--text-primary)]">{s.serial_no}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-[var(--text-primary)]">{s.item_name ?? "—"}</span>
                        <span className="text-[11px] text-[var(--text-dim)]">{s.item_code ?? ""}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-dim)]">{s.variant_name ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-dim)]">
                      {s.warehouse_name ? `${s.warehouse_code} — ${s.warehouse_name}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] ${statusClasses(s.status)}`}>
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-dim)]">{s.condition_status ?? "—"}</td>
                    <td className="px-3 py-2 text-[var(--text-dim)]">
                      {s.customer_name ?? s.supplier_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--text-dim)]">{fmtTimeAgo(s.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
