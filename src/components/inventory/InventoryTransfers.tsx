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
import { InventoryEmpty, Panel, StatusBadge } from "@/components/inventory/InventoryUi";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";
import InventoryTransferCreateDrawer from "./InventoryTransferCreateDrawer";
import {
  BulkActionBar,
  MobileBottomBar,
  MobileFab,
  OperatorMovementMenu,
  useInventoryShortcuts,
  useSelection,
} from "./InventoryUx";

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

const TABS: TabKey[] = ["all", "draft", "pending", "approved", "shipped", "received", "voided"];

export default function InventoryTransfers() {
  const { t } = useTranslation(inventoryT);
  useInventoryShortcuts({ isActive: true });
  const selection = useSelection<string>();

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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader
          title={t("inv.transfers.title")}
          subtitle={t("inv.transfers.subtitle")}
          action={
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-elevated)]"
            >
              <RrIcon name="plus" size={12} />
              {t("inv.transfers.new")}
            </button>
          }
        />
        <OperatorMovementMenu />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-300 dark:text-rose-200">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((k) => (
            <TabBtn key={k} active={tab === k} onClick={() => setTab(k)}>
              {t(`inv.transfers.tab.${k}`)}
            </TabBtn>
          ))}
          <div className="ml-auto text-[11px] text-[var(--text-dim)] tabular-nums">
            {loading ? "…" : `${filtered.length} of ${transfers.length}`}
          </div>
        </div>

        <Panel>
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-[10px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                <th className="px-2 py-2 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all shipped"
                    checked={filtered.length > 0 && filtered.filter((tr) => tr.status === "shipped").every((tr) => selection.has(tr.id))}
                    onChange={(e) => {
                      const ids = filtered.filter((tr) => tr.status === "shipped").map((tr) => tr.id);
                      if (e.target.checked) selection.set(ids);
                      else selection.clear();
                    }}
                  />
                </th>
                <th className="px-3 py-2 text-left">{t("inv.transfers.col.no")}</th>
                <th className="px-3 py-2 text-left">{t("inv.transfers.col.source")}</th>
                <th className="px-3 py-2 text-left">{t("inv.transfers.col.destination")}</th>
                <th className="px-3 py-2 text-right">{t("inv.transfers.col.items")}</th>
                <th className="px-3 py-2 text-right">{t("inv.transfers.col.qty")}</th>
                <th className="px-3 py-2 text-left">{t("inv.transfers.col.status")}</th>
                <th className="px-3 py-2 text-left">{t("inv.transfers.col.created")}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-[11px] text-[var(--text-dim)]">
                    {t("inv.transfers.loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-0 py-0">
                    <InventoryEmpty
                      title={t("inv.transfers.empty.title")}
                      hint={t("inv.transfers.empty.hint")}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((tr) => {
                  const src = warehouseMap.get(tr.source_warehouse_id);
                  const dest = warehouseMap.get(tr.destination_warehouse_id);
                  const roll = rollups[tr.id];
                  return (
                    <tr
                      key={tr.id}
                      className="border-b border-[var(--border-color)]/40 last:border-b-0 hover:bg-[var(--bg-surface)]/60"
                    >
                      <td className="px-2 py-1.5">
                        {tr.status === "shipped" ? (
                          <input
                            type="checkbox"
                            aria-label={`Select ${tr.transfer_no}`}
                            checked={selection.has(tr.id)}
                            onChange={() => selection.toggle(tr.id)}
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11.5px] text-[var(--text-secondary)]">
                        <Link href={`/inventory/transfers/${tr.id}`} className="hover:underline">
                          {tr.transfer_no}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-[var(--text-secondary)]">
                        {src ? `${src.code} — ${src.name}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-[var(--text-secondary)]">
                        {dest ? `${dest.code} — ${dest.name}` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                        {roll?.item_count ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[var(--text-secondary)]">
                        {roll
                          ? Number(roll.total_qty).toLocaleString("en-US", { maximumFractionDigits: 2 })
                          : "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={tr.status} />
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-[var(--text-dim)]">
                        {new Date(tr.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Link
                          href={`/inventory/transfers/${tr.id}`}
                          className="text-[11px] text-[var(--text-secondary)] hover:underline"
                        >
                          Details →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
      </div>
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
