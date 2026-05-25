"use client";

/* ---------------------------------------------------------------------------
   /inventory — INV-H10 visual redesign.

   Layout (top to bottom):
     1. InventoryHeader (no tab strip on home — nav cards replace it)
     2. Nav cards grid — all routes as icon cards + search bar below
     3. KPI strip — 4 stat cards (Total Items · Receipts · Shipments · Alerts)
     4. Quick Actions — 4 large primary action tiles
     5. Alerts section — only when totalAlerts > 0; colored left-border cards
     6. Today's Activity — 4 stat tiles always visible
     7. Quick Lookup — 3 inline search inputs
     8. Intelligence — 4 intel tiles always visible
     9. Manager-only deep links row (Balances + Movements ledger)
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import InventoryHeader from "@/components/inventory/InventoryHeader";
import InventoryInternalItemDrawer from "@/components/inventory/InventoryInternalItemDrawer";
import RrIcon from "@/components/ui/RrIcon";
import AppHomeMenu, { type AppHomeNavItem } from "@/components/ui/AppHomeMenu";
import KpiCard from "@/components/ui/KpiCard";
import Button from "@/components/ui/Button";
import { ACCENT } from "@/lib/accentColors";
import {
  ActionCard,
  AlertCard,
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

/* ── Nav card entries — all 10 routes, always shown (pages themselves are RLS-gated) ── */
const NAV_CARDS: AppHomeNavItem[] = [
  { href: "/inventory",           icon: "home",         label: "Home",       chipBg: ACCENT.blue.chipBg,  chipText: ACCENT.blue.chipText  },
  { href: "/inventory/items",     icon: "box-open",     label: "Items",      chipBg: ACCENT.blue.chipBg,  chipText: ACCENT.blue.chipText  },
  { href: "/inventory/movements", icon: "file-invoice", label: "Movements",  chipBg: ACCENT.blue.chipBg,  chipText: ACCENT.blue.chipText  },
  { href: "/inventory/transfers", icon: "truck-side",   label: "Transfers",  chipBg: ACCENT.blue.chipBg,  chipText: ACCENT.blue.chipText  },
  { href: "/inventory/returns",   icon: "recycle",      label: "Returns",    chipBg: ACCENT.blue.chipBg,  chipText: ACCENT.blue.chipText  },
  { href: "/inventory/search",    icon: "search",       label: "Search",     chipBg: ACCENT.teal.chipBg,  chipText: ACCENT.teal.chipText  },
  { href: "/inventory/balances",  icon: "badge-check",  label: "Balances",   chipBg: ACCENT.teal.chipBg,  chipText: ACCENT.teal.chipText  },
  { href: "/inventory/serials",   icon: "fingerprint",  label: "Serials",    chipBg: ACCENT.teal.chipBg,  chipText: ACCENT.teal.chipText  },
  { href: "/inventory/batches",   icon: "box-circle-check", label: "Batches",chipBg: ACCENT.teal.chipBg,  chipText: ACCENT.teal.chipText  },
  { href: "/inventory/warehouses",icon: "building",     label: "Warehouses", chipBg: ACCENT.amber.chipBg, chipText: ACCENT.amber.chipText },
];

/* ── Dashboard ────────────────────────────────────────────────────────────── */
export default function InventoryDashboard() {
  const { t } = useTranslation(inventoryT);
  useInventoryShortcuts({ isActive: true });
  const { isManager } = useInventoryViewMode();

  const [op, setOp] = useState<OperatorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* INV-H9 — Add Internal Item drawer state. */
  const [internalDrawerOpen, setInternalDrawerOpen] = useState(false);

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

  const todayTotal =
    (op?.today.receipts ?? 0) +
    (op?.today.shipments ?? 0) +
    (op?.today.transfers ?? 0) +
    (op?.today.returns ?? 0);

  /* Add Internal Item button — lives in the header action slot */
  const addInternalBtn = (
    <Button
      variant="secondary"
      size="sm"
      icon="briefcase"
      onClick={() => setInternalDrawerOpen(true)}
      data-testid="inv-home-add-internal"
      aria-label={t("inv.home.add_internal", "Add Internal Item")}
    >
      {t("inv.home.add_internal", "Add Internal Item")}
    </Button>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 sm:px-6">

        {/* ── 1. Odoo-style compact header (menu inline) ──────────── */}
        <InventoryHeader
          icon="home"
          title={t("inv.home.title")}
          subtitle={t("inv.home.subtitle")}
          action={
            <div className="flex items-center gap-2">
              {addInternalBtn}
              <ViewModeToggle />
            </div>
          }
        />

        {/* Error banner */}
        {error && (
          <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* ── 3. KPI strip ────────────────────────────────────────── */}
        <section data-testid="inv-home-kpis">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              icon="box-open"
              label="Stock Items"
              value="—"
              loading={loading}
            />
            <KpiCard
              icon="download"
              label="Today's Receipts"
              value={op?.today.receipts ?? 0}
              loading={loading}
            />
            <KpiCard
              icon="truck-side"
              label="Today's Shipments"
              value={op?.today.shipments ?? 0}
              loading={loading}
            />
            <KpiCard
              icon="shield-check"
              label="Pending Actions"
              value={totalAlerts}
              loading={loading}
            />
          </div>
        </section>

        {/* ── 4. Quick Actions ────────────────────────────────────── */}
        <section data-testid="inv-home-actions">
          <SectionEyebrow>{t("inv.home.quick.title")}</SectionEyebrow>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ActionCard testId="action-receive"  icon="download"       label={t("inv.action.receive")}  hint={t("inv.action.receive.hint")}  href="/inventory/movements?create=receive"    tone="positive" size="primary" />
            <ActionCard testId="action-ship"     icon="truck-side"     label={t("inv.action.ship")}     hint={t("inv.action.ship.hint")}     href="/inventory/movements?create=ship"       tone="info"     size="primary" />
            <ActionCard testId="action-transfer" icon="shipping-fast"  label={t("inv.action.transfer")} hint={t("inv.action.transfer.hint")} href="/inventory/transfers?create=1"          tone="info"     size="primary" />
            <ActionCard testId="action-adjust"   icon="pencil"         label={t("inv.action.adjust")}   hint={t("inv.action.adjust.hint")}   href="/inventory/movements?create=adjustment" tone="warning"  size="primary" />
          </div>
        </section>

        {/* ── 5. Alerts — only when there's something to flag ─────── */}
        {!loading && totalAlerts > 0 && (
          <section data-testid="inv-home-alerts">
            <SectionEyebrow>{t("inv.home.alerts.title")}</SectionEyebrow>
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

        {/* ── 6. Today's Activity — always visible ─────────────────── */}

        <section data-testid="inv-home-today">
          <div className="flex items-center gap-2">
            <SectionEyebrow>{t("inv.home.today.title")}</SectionEyebrow>
            {!loading && todayTotal > 0 && (
              <span className="mb-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 py-0.5 text-[10px] tabular-nums text-[var(--text-dim)]">
                {todayTotal} total
              </span>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TodayTile icon="download"      label={t("inv.today.receipts")}  value={op?.today.receipts ?? 0}  href="/inventory/movements?direction=in" />
            <TodayTile icon="truck-side"    label={t("inv.today.shipments")} value={op?.today.shipments ?? 0} href="/inventory/movements?direction=out" />
            <TodayTile icon="shipping-fast" label={t("inv.today.transfers")} value={op?.today.transfers ?? 0} href="/inventory/transfers" />
            <TodayTile icon="recycle"       label={t("inv.today.returns")}   value={op?.today.returns ?? 0}   href="/inventory/returns" />
          </div>
        </section>

        {/* ── 7. Quick Lookup — always visible ─────────────────────── */}
        <section data-testid="inv-home-lookup">
          <div className="flex items-center justify-between">
            <SectionEyebrow>{t("inv.home.lookup.title")}</SectionEyebrow>
            <Link
              href="/inventory/search"
              className="mb-2 text-[11px] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)]"
            >
              Advanced search →
            </Link>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            <LookupInput icon="box-open"    placeholder={t("inv.home.lookup.item")}   type="item" />
            <LookupInput icon="fingerprint" placeholder={t("inv.home.lookup.serial")} type="serial" />
            <LookupInput icon="clock"       placeholder={t("inv.home.lookup.batch")}  type="batch" />
          </div>
        </section>

        {/* ── 8. Intelligence — always visible ─────────────────────── */}
        <section data-testid="inv-home-intel">
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
        </section>

        {/* ── 9. Manager-only deep links ───────────────────────────── */}
        {isManager && (
          <section data-testid="inv-home-manager-links">
            <SectionEyebrow>Manager</SectionEyebrow>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                href="/inventory/balances"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11.5px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                <RrIcon name="badge-check" size={12} />
                Balances
              </Link>
              <Link
                href="/inventory/movements"
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11.5px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
              >
                <RrIcon name="file-invoice" size={12} />
                Movements ledger
              </Link>
            </div>
          </section>
        )}

      </div>

      <MobileFab />
      <MobileBottomBar />

      {internalDrawerOpen && (
        <InventoryInternalItemDrawer
          onClose={() => setInternalDrawerOpen(false)}
          onSuccess={() => setInternalDrawerOpen(false)}
        />
      )}
    </div>
  );
}
