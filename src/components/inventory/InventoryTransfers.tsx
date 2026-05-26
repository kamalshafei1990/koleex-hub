"use client";

/* ---------------------------------------------------------------------------
   /inventory/transfers — list page + "New Transfer" drawer.

   Phase INV-H3A. Status tabs: Draft · Pending · Approved · Shipped ·
   Received · Voided. The page is read-only — actions happen on the
   detail page. The only mutating control here is "+ New Transfer".
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import RrIcon from "@/components/ui/RrIcon";
import { InventoryEmpty, Panel } from "@/components/inventory/InventoryUi";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation, type Translations } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";
import InventoryTransferCreateDrawer from "./InventoryTransferCreateDrawer";
import {
  BulkActionBar,
  HumanStatusPill,
  MobileBottomBar,
  MobileFab,
  OperatorMovementMenu,
  humanStatus,
  relativeTime,
  useInventoryShortcuts,
  useSelection,
} from "./InventoryUx";

/* INV-H5D — local i18n extension for the operator polish strings. */
const TR_T: Translations = {
  "inv.transfers.action.receive":  { en: "Mark received",   zh: "标记已接收",       ar: "تحديد كمستلم" },
  "inv.transfers.action.view":     { en: "Open",            zh: "打开",            ar: "فتح" },
  "inv.transfers.details.show":    { en: "View details",    zh: "查看详情",        ar: "عرض التفاصيل" },
  "inv.transfers.details.hide":    { en: "Hide details",    zh: "隐藏详情",        ar: "إخفاء التفاصيل" },
  "inv.transfers.filters.more":    { en: "More filters",    zh: "更多筛选",        ar: "مزيد من المرشحات" },
  "inv.transfers.filters.fewer":   { en: "Fewer filters",   zh: "收起筛选",        ar: "تقليل المرشحات" },
  "inv.transfers.row.items":       { en: "{n} items",       zh: "{n} 条",          ar: "{n} عناصر" },
  "inv.transfers.row.qty":         { en: "qty {n}",         zh: "数量 {n}",        ar: "كمية {n}" },
};

type TransferStatus =
  | "draft" | "pending" | "approved" | "shipped" | "received" | "cancelled" | "voided";

interface TransferRow {
  id: string;
  transfer_no: string;
  status: TransferStatus;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  notes: string | null;
  created_at: string;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
}

interface TransferRollup {
  item_count: number;
  total_qty: number;
}

type TabKey = "all" | "draft" | "pending" | "approved" | "shipped" | "received" | "voided";

/* Primary filter chips (most operators only care about these three).
 * Everything else is one click away via "More filters". */
const PRIMARY_TABS: TabKey[] = ["all", "pending", "shipped"];
const SECONDARY_TABS: TabKey[] = ["draft", "approved", "received", "voided"];

export default function InventoryTransfers() {
  const { t } = useTranslation({ ...inventoryT, ...TR_T });
  useInventoryShortcuts({ isActive: true });
  const selection = useSelection<string>();
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rollups, setRollups] = useState<Record<string, TransferRollup>>({});
  const [tab, setTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  /* INV-H5A — ?create=1 deep link from operator menu */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") setCreateOpen(true);
  }, []);

  /* INV-H5A — bulk receive on shipped transfers. */
  const bulkComplete = async () => {
    if (selection.count === 0) return;
    const ids = [...selection.ids];
    for (const id of ids) {
      try {
        await fetch(`/api/inventory/transfers/${id}/receive`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch { /* re-loaded below */ }
    }
    selection.clear();
    await load();
  };

  const warehouseMap = useMemo(() => {
    const m = new Map<string, Warehouse>();
    for (const w of warehouses) m.set(w.id, w);
    return m;
  }, [warehouses]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, whRes] = await Promise.all([
        fetch("/api/inventory/transfers?limit=500", { cache: "no-store", credentials: "include" }),
        fetch("/api/inventory/warehouses", { cache: "no-store", credentials: "include" }),
      ]);
      const tJ = await tRes.json();
      if (!tRes.ok) throw new Error(humanizeError(tJ.error ?? `HTTP ${tRes.status}`));
      const list = (tJ.transfers ?? []) as TransferRow[];
      setTransfers(list);
      const whJ = await whRes.json();
      setWarehouses((whJ.warehouses ?? []) as Warehouse[]);

      /* Best-effort: pull rollups for the visible transfers. */
      const rolls: Record<string, TransferRollup> = {};
      await Promise.all(
        list.slice(0, 100).map(async (tr) => {
          try {
            const d = await fetch(`/api/inventory/transfers/${tr.id}`, {
              cache: "no-store",
              credentials: "include",
            });
            const dj = await d.json();
            if (d.ok) {
              const items = (dj.items ?? []) as Array<{ quantity: number }>;
              rolls[tr.id] = {
                item_count: items.length,
                total_qty: items.reduce((a, b) => a + Number(b.quantity || 0), 0),
              };
            }
          } catch {/* ignore — row will show — */}
        }),
      );
      setRollups(rolls);
    } catch (e) {
      setError(humanizeError(e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === "all") return transfers;
    return transfers.filter((t) => t.status === tab);
  }, [transfers, tab]);

  /* Page wrapper + InventoryHeader provided by /app/inventory/layout.tsx.
     The "New transfer" action button used to live in the header — it now
     renders as the first row inside the body so it stays with the list. */
  return (
    <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
          >
            <RrIcon name="plus" size={12} />
            {t("inv.transfers.new")}
          </button>
        </div>
        <OperatorMovementMenu />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-300 dark:text-rose-200">
            {error}
          </div>
        )}

        {/* INV-H5D — filter strip: primary chips + "More filters" disclosure.
            Secondary statuses (draft/approved/received/voided) are one click
            away rather than always crowding the row. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRIMARY_TABS.map((k) => (
            <TabBtn key={k} active={tab === k} onClick={() => setTab(k)}>
              {t(`inv.transfers.tab.${k}`)}
            </TabBtn>
          ))}
          {showMoreFilters && SECONDARY_TABS.map((k) => (
            <TabBtn key={k} active={tab === k} onClick={() => setTab(k)}>
              {t(`inv.transfers.tab.${k}`)}
            </TabBtn>
          ))}
          <button
            type="button"
            onClick={() => setShowMoreFilters((v) => !v)}
            className="rounded-md border border-[var(--border-subtle)] bg-transparent px-2.5 py-1.5 text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            {showMoreFilters ? t("inv.transfers.filters.fewer") : t("inv.transfers.filters.more")}
          </button>
          <div className="ml-auto text-[11px] text-[var(--text-dim)] tabular-nums">
            {loading ? "…" : `${filtered.length} of ${transfers.length}`}
          </div>
        </div>

        <Panel>
          {loading && filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[11px] text-[var(--text-dim)]">
              {t("inv.transfers.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <InventoryEmpty
              icon="truck-side"
              title={t("inv.transfers.empty.title")}
              hint={t("inv.transfers.empty.hint")}
            />
          ) : (
            <ul role="list" className="divide-y divide-[var(--border-color)]/40">
              {filtered.map((tr) => {
                const src = warehouseMap.get(tr.source_warehouse_id);
                const dest = warehouseMap.get(tr.destination_warehouse_id);
                const roll = rollups[tr.id];
                const isExpanded = expanded.has(tr.id);
                const itemCount = roll?.item_count;
                const primaryActionLabel =
                  tr.status === "shipped"
                    ? t("inv.transfers.action.receive")
                    : t("inv.transfers.action.view");
                const onPrimary = async () => {
                  if (tr.status === "shipped") {
                    try {
                      await fetch(`/api/inventory/transfers/${tr.id}/receive`, {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({}),
                      });
                      await load();
                    } catch { /* ignore */ }
                  } else {
                    window.location.href = `/inventory/transfers/${tr.id}`;
                  }
                };
                return (
                  <li
                    key={tr.id}
                    className="px-3 py-3.5 transition-colors hover:bg-[var(--bg-surface)]/60 sm:px-4"
                  >
                    {/* Operator row — stacked on mobile, inline on desktop */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      {/* Select checkbox (only meaningful for shipped) */}
                      {tr.status === "shipped" ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${tr.transfer_no}`}
                          checked={selection.has(tr.id)}
                          onChange={() => selection.toggle(tr.id)}
                          className="hidden sm:block"
                        />
                      ) : (
                        <span className="hidden sm:block sm:w-[16px]" aria-hidden />
                      )}

                      {/* Icon + from → to */}
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
                        <RrIcon name="shipping-fast" size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium text-[var(--text-primary)]">
                          <span className="truncate">{src ? src.code : "—"}</span>
                          <span aria-hidden className="text-[var(--text-dim)]">
                            <RrIcon name="arrow-up-right" size={11} />
                          </span>
                          <span className="truncate">{dest ? dest.code : "—"}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--text-dim)]">
                          {itemCount != null
                            ? t("inv.transfers.row.items").replace("{n}", String(itemCount))
                            : "—"}
                          {" · "}
                          {relativeTime(tr.created_at)}
                        </div>
                      </div>

                      {/* Humanized status + primary action */}
                      <div className="flex items-center gap-2 sm:ml-auto">
                        <HumanStatusPill status={tr.status} />
                        <button
                          type="button"
                          onClick={onPrimary}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] sm:min-h-0 sm:py-1.5"
                        >
                          {primaryActionLabel}
                        </button>
                      </div>
                    </div>

                    {/* INV-H5D — collapsed "View details": raw enum, IDs,
                        absolute timestamps, transfer #, full warehouse names. */}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(tr.id)}
                        className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:underline"
                      >
                        {isExpanded ? t("inv.transfers.details.hide") : t("inv.transfers.details.show")}
                      </button>
                      <Link
                        href={`/inventory/transfers/${tr.id}`}
                        className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:underline"
                      >
                        Open →
                      </Link>
                    </div>
                    {isExpanded && (
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 px-3 py-2 text-[11px] sm:grid-cols-2">
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("inv.transfers.col.no")}</dt>
                          <dd className="font-mono text-[var(--text-secondary)]">{tr.transfer_no}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">Raw status</dt>
                          <dd className="text-[var(--text-secondary)]">{tr.status} → {humanStatus(tr.status)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("inv.transfers.col.source")}</dt>
                          <dd className="text-[var(--text-secondary)]">{src ? `${src.code} — ${src.name}` : "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("inv.transfers.col.destination")}</dt>
                          <dd className="text-[var(--text-secondary)]">{dest ? `${dest.code} — ${dest.name}` : "—"}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("inv.transfers.col.qty")}</dt>
                          <dd className="tabular-nums text-[var(--text-secondary)]">
                            {roll
                              ? Number(roll.total_qty).toLocaleString("en-US", { maximumFractionDigits: 2 })
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-[var(--text-dim)]">{t("inv.transfers.col.created")}</dt>
                          <dd className="text-[var(--text-secondary)]">
                            {new Date(tr.created_at).toLocaleString()}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {createOpen && (
          <InventoryTransferCreateDrawer
            onClose={() => setCreateOpen(false)}
            onCreated={async () => {
              setCreateOpen(false);
              await load();
            }}
          />
        )}
      <BulkActionBar
        count={selection.count}
        onClear={selection.clear}
        actions={[{ label: "Mark received", icon: "download", onClick: bulkComplete, tone: "primary" }]}
      />
      <MobileFab />
      <MobileBottomBar />
    </div>
  );
}

function TabBtn({
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
