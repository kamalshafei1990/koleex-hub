"use client";

/* ---------------------------------------------------------------------------
   /inventory — INV-H6 operator-first dashboard (radical simplification).

   Default view (operator):
     1. Four BIG action cards (Receive / Ship / Transfer / Adjust)
     2. Secondary utility tiles (Search · Low Stock · Returns · Serials · Batches)
     3. Active alerts list (only when there ARE alerts — empty state hidden)
     4. "Today & intel" accordion (collapsed by default) — Today counters +
         IntelTiles + quick-lookup all live here.

   Manager view (toggle in header): same layout, accordion auto-expanded.

   The H5A finance-style "top holders / valuation / KPI strip" was removed.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import {
  ActionCard,
  AlertCard,
  DetailsAccordion,
  IntelTile,
  LookupInput,
  MobileBottomBar,
  MobileFab,
  SectionEyebrow,
  TodayTile,
  ViewModeToggle,
  useInventoryShortcuts,
  useInventoryViewMode,
} from "@/components/inventory/InventoryUx";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";

interface OperatorSummary {
  today: { receipts: number; shipments: number; transfers: number; returns: number };
  alerts: {
    low_stock: number;
    expired_batches: number;
    pending_approvals: number;
    pending_transfers: number;
    pending_returns: number;
    stuck_serials: number;
    stale_drafts: number;
  };
  intel: {
    fastest_moving: Array<{ inventory_item_id: string; item_code: string; item_name: string | null; moves: number }>;
    stagnant: Array<{ inventory_item_id: string; item_code: string; item_name: string | null; days_idle: number }>;
    busiest_warehouse: { warehouse_id: string; warehouse_code: string; warehouse_name: string; moves: number } | null;
    most_returned: { inventory_item_id: string; item_code: string; item_name: string | null; returns: number } | null;
  };
}

export default function InventoryDashboard() {
  const { t } = useTranslation(inventoryT);
  useInventoryShortcuts({ isActive: true });
  const { isManager } = useInventoryViewMode();

  const [op, setOp] = useState<OperatorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const opRes = await fetch("/api/inventory/operator-summary", { credentials: "include", cache: "no-store" });
        const opJ = await opRes.json();
        if (cancelled) return;
        if (opRes.ok) setOp(opJ.summary as OperatorSummary);
        else setError(opJ.error ?? "Failed to load");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalAlerts =
    (op?.alerts.low_stock ?? 0) +
    (op?.alerts.expired_batches ?? 0) +
    (op?.alerts.pending_approvals ?? 0) +
    (op?.alerts.pending_transfers ?? 0) +
    (op?.alerts.pending_returns ?? 0) +
    (op?.alerts.stuck_serials ?? 0) +
    (op?.alerts.stale_drafts ?? 0);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <InventoryHeader
          title={t("inv.home.title")}
          subtitle={t("inv.home.subtitle")}
          action={<ViewModeToggle />}
        />

        {error && (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* 1. Primary actions — dominate the page. */}
        <section data-testid="inv-home-actions">
          <div className="flex items-baseline justify-between">
            <SectionEyebrow>{t("inv.home.quick.title")}</SectionEyebrow>
            <span className="text-[10.5px] text-[var(--text-dim)]">{t("inv.shortcuts.hint")}</span>
          </div>
          <div data-testid="inv-home-quick-actions" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ActionCard testId="action-receive"  icon="download"       label={t("inv.action.receive")}  hint={t("inv.action.receive.hint")}  href="/inventory/movements?create=receive"    tone="positive" size="primary" />
            <ActionCard testId="action-ship"     icon="truck-side"     label={t("inv.action.ship")}     hint={t("inv.action.ship.hint")}     href="/inventory/movements?create=ship"       tone="info"     size="primary" />
            <ActionCard testId="action-transfer" icon="shipping-fast"  label={t("inv.action.transfer")} hint={t("inv.action.transfer.hint")} href="/inventory/transfers?create=1"          tone="info"     size="primary" />
            <ActionCard testId="action-adjust"   icon="pencil"         label={t("inv.action.adjust")}   hint={t("inv.action.adjust.hint")}   href="/inventory/movements?create=adjustment" tone="warning"  size="primary" />
          </div>
        </section>

        {/* 1b. Secondary utility tiles. */}
        <section data-testid="inv-home-secondary">
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <ActionCard size="secondary" icon="search"        label="Search"     href="/inventory/search" />
            <ActionCard size="secondary" icon="interrogation" label="Low Stock"  href="/inventory/items?filter=low_stock" />
            <ActionCard size="secondary" icon="recycle"       label="Returns"    href="/inventory/returns" />
            <ActionCard size="secondary" icon="fingerprint"   label="Serials"    href="/inventory/serials" />
            <ActionCard size="secondary" icon="clock"         label="Batches"    href="/inventory/batches" />
          </div>
        </section>

        {/* 2. Active alerts — only rendered when there's something to flag.
              Empty state is hidden entirely so the calm operator view stays calm. */}
        {!loading && totalAlerts > 0 && (
          <section data-testid="inv-home-alerts">
            <div className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {t("inv.home.alerts.title")}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(op?.alerts.low_stock ?? 0) > 0 && (
                <AlertCard icon="interrogation" label={t("inv.alert.low_stock")} count={op!.alerts.low_stock} href="/inventory/items?filter=low_stock" tone="warning" />
              )}
              {(op?.alerts.expired_batches ?? 0) > 0 && (
                <AlertCard icon="clock" label={t("inv.alert.expired_batches")} count={op!.alerts.expired_batches} href="/inventory/batches?status=expired" tone="rose" />
              )}
              {(op?.alerts.pending_approvals ?? 0) > 0 && (
                <AlertCard icon="shield-check" label={t("inv.alert.pending_approvals")} count={op!.alerts.pending_approvals} href="/inventory/movements?approval=pending" tone="warning" />
              )}
              {(op?.alerts.pending_transfers ?? 0) > 0 && (
                <AlertCard icon="shipping-fast" label={t("inv.alert.pending_transfers")} count={op!.alerts.pending_transfers} href="/inventory/transfers?status=approved" tone="info" />
              )}
              {(op?.alerts.pending_returns ?? 0) > 0 && (
                <AlertCard icon="recycle" label={t("inv.alert.pending_returns")} count={op!.alerts.pending_returns} href="/inventory/returns?status=approved" tone="info" />
              )}
              {(op?.alerts.stuck_serials ?? 0) > 0 && (
                <AlertCard icon="fingerprint" label={t("inv.alert.stuck_serials")} count={op!.alerts.stuck_serials} href="/inventory/serials?status=in_transit" tone="rose" />
              )}
              {(op?.alerts.stale_drafts ?? 0) > 0 && (
                <AlertCard icon="file" label={t("inv.alert.stale_drafts")} count={op!.alerts.stale_drafts} href="/inventory/movements?tab=drafts" tone="warning" />
              )}
            </div>
          </section>
        )}

        {/* 3. Today + intel + lookup — collapsed by default for operators.
              Manager view opens the accordion automatically. */}
        <DetailsAccordion
          label={t("inv.home.today.title") + " · " + t("inv.home.intel.title")}
          defaultOpen={isManager}
          testId="inv-home-extras"
        >
          <div className="space-y-4">
            <div>
              <SectionEyebrow>{t("inv.home.today.title")}</SectionEyebrow>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <TodayTile icon="download"      label={t("inv.today.receipts")}  value={op?.today.receipts ?? 0}  href="/inventory/movements?direction=in" />
                <TodayTile icon="truck-side"    label={t("inv.today.shipments")} value={op?.today.shipments ?? 0} href="/inventory/movements?direction=out" />
                <TodayTile icon="shipping-fast" label={t("inv.today.transfers")} value={op?.today.transfers ?? 0} href="/inventory/transfers" />
                <TodayTile icon="recycle"       label={t("inv.today.returns")}   value={op?.today.returns ?? 0}   href="/inventory/returns" />
              </div>
            </div>
            <div>
              <SectionEyebrow>{t("inv.home.lookup.title")}</SectionEyebrow>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                <LookupInput icon="box-open"    placeholder={t("inv.home.lookup.item")}   type="item" />
                <LookupInput icon="fingerprint" placeholder={t("inv.home.lookup.serial")} type="serial" />
                <LookupInput icon="clock"       placeholder={t("inv.home.lookup.batch")}  type="batch" />
              </div>
              <div className="mt-2 text-right text-[11px]">
                <Link href="/inventory/search" className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                  Advanced search →
                </Link>
              </div>
            </div>
            <div>
              <SectionEyebrow>{t("inv.home.intel.title")}</SectionEyebrow>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <IntelTile
                  icon="bullseye-arrow"
                  label={t("inv.home.intel.fastest")}
                  primary={op?.intel.fastest_moving[0]?.item_code ?? "—"}
                  secondary={op?.intel.fastest_moving[0] ? `${op.intel.fastest_moving[0].item_name ?? ""} · ${op.intel.fastest_moving[0].moves} moves` : ""}
                  href={op?.intel.fastest_moving[0] ? `/inventory/items/${op.intel.fastest_moving[0].inventory_item_id}` : undefined}
                />
                <IntelTile
                  icon="clock"
                  label={t("inv.home.intel.stagnant")}
                  primary={op?.intel.stagnant[0]?.item_code ?? "—"}
                  secondary={op?.intel.stagnant[0]?.item_name ?? ""}
                  href={op?.intel.stagnant[0] ? `/inventory/items/${op.intel.stagnant[0].inventory_item_id}` : undefined}
                />
                <IntelTile
                  icon="bank"
                  label={t("inv.home.intel.busiest")}
                  primary={op?.intel.busiest_warehouse?.warehouse_code ?? "—"}
                  secondary={op?.intel.busiest_warehouse ? `${op.intel.busiest_warehouse.warehouse_name} · ${op.intel.busiest_warehouse.moves} moves` : ""}
                  href={op?.intel.busiest_warehouse ? `/inventory/warehouses` : undefined}
                />
                <IntelTile
                  icon="recycle"
                  label={t("inv.home.intel.returned")}
                  primary={op?.intel.most_returned?.item_code ?? "—"}
                  secondary={op?.intel.most_returned ? `${op.intel.most_returned.item_name ?? ""} · ${op.intel.most_returned.returns} returns` : ""}
                  href={op?.intel.most_returned ? `/inventory/items/${op.intel.most_returned.inventory_item_id}` : undefined}
                />
              </div>
            </div>
            {/* Manager-only deep links — Balances + Movements ledger. */}
            {isManager && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link href="/inventory/balances" className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11.5px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]">
                  Balances →
                </Link>
                <Link href="/inventory/movements" className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11.5px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]">
                  Movements ledger →
                </Link>
              </div>
            )}
          </div>
        </DetailsAccordion>
      </div>

      <MobileFab />
      <MobileBottomBar />
    </div>
  );
}
