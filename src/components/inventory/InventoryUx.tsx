"use client";

/* ---------------------------------------------------------------------------
   InventoryUx — INV-H5A shared operator UX primitives.

   Houses small components that the dashboard, list pages, and detail
   pages all use:
     · ActionCard         — large quick-action tile (Receive / Ship / …)
     · AlertCard          — banner-style operational alert tile
     · TodayTile          — compact "Today" counter tile
     · IntelTile          — operator-intelligence one-liner tile
     · LookupInput        — debounced quick-lookup input
     · BulkActionBar      — sticky bottom selection bar
     · MobileFab          — floating create button (inventory routes)
     · MobileBottomBar    — sticky mobile bottom bar
     · TraceabilityCard   — cross-link card for detail pages
     · OperatorMovementMenu — Receive / Ship / Transfer / Adjust / Return menu
     · useInventoryShortcuts — R/S/T/A/F keyboard shortcuts hook
     · operatorLabel      — humanize movement_type with i18n awareness
     · useDebouncedValue  — small debounce helper (perf)
   --------------------------------------------------------------------------- */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { inventoryT } from "@/lib/translations/inventory";

/* ─── useInventoryViewMode ─────────────────────────────────────
   INV-H6 — single-app role-based visibility.

   Returns `'operator' | 'manager'` based on:
     1. localStorage override at key `inv:viewMode` (lets managers
        preview the operator view via a small header toggle).
     2. Falls back to fetching /api/me once per session; managers /
        super-admins land on `'manager'`, everyone else on `'operator'`.

   No new backend, no new auth model. Pure UI gating — backend / RLS
   stays the source of truth for what data is actually returned.
   --------------------------------------------------------------- */

type InventoryViewMode = "operator" | "manager";

const VIEW_MODE_KEY = "inv:viewMode";

function readStoredMode(): InventoryViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY);
    return v === "operator" || v === "manager" ? v : null;
  } catch { return null; }
}

export function useInventoryViewMode(): {
  mode: InventoryViewMode;
  setMode: (next: InventoryViewMode) => void;
  isManager: boolean;
  canSwitch: boolean;
} {
  const [serverMode, setServerMode] = useState<InventoryViewMode | null>(null);
  const [override, setOverride] = useState<InventoryViewMode | null>(() => readStoredMode());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/me", { credentials: "include", cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        const isAdmin =
          j?.is_super_admin === true ||
          j?.can_view_private === true ||
          j?.account?.is_super_admin === true;
        setServerMode(isAdmin ? "manager" : "operator");
      } catch { /* default to operator */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const mode: InventoryViewMode = override ?? serverMode ?? "operator";
  const setMode = useCallback((next: InventoryViewMode) => {
    setOverride(next);
    try { window.localStorage.setItem(VIEW_MODE_KEY, next); } catch {/* ignore */}
  }, []);
  /* Managers can switch back and forth; operators are pinned. */
  const canSwitch = serverMode === "manager" || override !== null;
  return { mode, setMode, isManager: mode === "manager", canSwitch };
}

/* ─── ViewModeToggle ───────────────────────────────────────────
   Small "Operator / Manager" toggle. Rendered in the page header
   on inventory routes; only visible for users with manager-level
   server role (so operators can't escalate themselves via UI). */
export function ViewModeToggle() {
  const { mode, setMode, canSwitch } = useInventoryViewMode();
  if (!canSwitch) return null;
  const next: InventoryViewMode = mode === "operator" ? "manager" : "operator";
  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      data-testid="inv-view-mode-toggle"
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[10.5px] uppercase tracking-[0.10em] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
      title={`Switch to ${next} view`}
    >
      <RrIcon name={mode === "manager" ? "shield-check" : "user-headset"} size={10} />
      {mode}
    </button>
  );
}

/* ─── DetailsAccordion ─────────────────────────────────────────
   INV-H6 — single collapsed "Details" disclosure. Used on every
   detail page to push timeline / audit log / raw IDs / source
   document references out of the default operator view. */
export function DetailsAccordion({
  label = "Details",
  defaultOpen = false,
  testId,
  children,
}: {
  label?: string;
  defaultOpen?: boolean;
  testId?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      data-testid={testId ?? "inv-details-accordion"}
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
          {label}
        </span>
        <span className="text-[var(--text-dim)] text-[12px]">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border-subtle)] px-4 py-3">
          {children}
        </div>
      )}
    </section>
  );
}

/* ─── Debounce hook (perf) ─────────────────────────────────── */

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/* ─── Operator label mapping ───────────────────────────────── */

/** Hide DB enums from the operator. Used in pickers and movement
 *  rows. Maps every movement_type to one of five verbs. */
export function operatorLabel(movementType: string): string {
  switch (movementType) {
    case "purchase_receipt":
    case "opening_balance":
    case "adjustment_in":
    case "return_in":
      return "Receive";
    case "sales_shipment":
    case "adjustment_out":
    case "return_out":
      return "Ship";
    case "transfer_in":
    case "transfer_out":
      return "Transfer";
    case "manual":
      return "Adjustment";
    default:
      return movementType;
  }
}

/* ─── Humanized status label ───────────────────────────────────
   INV-H5D — operator-friendly status text. Replaces raw enum
   ("approved", "received", "voided") with a humanized phrase that
   reads sensibly inline. Used by Transfers and Returns list rows. */
export function humanStatus(status: string): string {
  switch (status) {
    case "draft":            return "Draft";
    case "pending":          return "Pending approval";
    case "approved":         return "Approved";
    case "shipped":          return "Shipped";
    case "received":         return "Received";
    case "completed":        return "Completed";
    case "cancelled":        return "Cancelled";
    case "voided":           return "Voided";
    case "posted":           return "Posted";
    case "active":           return "Active";
    case "inactive":         return "Inactive";
    case "archived":         return "Archived";
    default:                 return status;
  }
}

/* ─── Relative time helper ─────────────────────────────────────
   INV-H5D — humanize timestamps to "2h ago", "3d ago", "Just now".
   Keeps the row scannable; absolute timestamps move into expanded
   details. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000)         return "Just now";
  if (diff < 3_600_000)      return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)     return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / (7 * 86_400_000))}w ago`;
  return new Date(t).toLocaleDateString();
}

/* ─── Humanized status pill ────────────────────────────────────
   INV-H5D — colored pill, lowercase-friendly. Reads humanStatus()
   so operators never see a raw enum in the list row. */
export function HumanStatusPill({ status }: { status: string }) {
  /* Each tint pairs a saturated text color (legible on light backgrounds)
     with a dark-mode brightener so the same pill works in both themes. */
  const cls =
    status === "posted" || status === "active" || status === "received" || status === "completed"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
      : status === "voided" || status === "archived" || status === "cancelled"
        ? "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]"
        : status === "draft" || status === "inactive" || status === "pending"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
          : status === "approved" || status === "shipped"
            ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-200"
            : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] tracking-tight ${cls}`}>
      {humanStatus(status)}
    </span>
  );
}

/* ─── ActionCard ───────────────────────────────────────────── */

export function ActionCard({
  icon,
  label,
  hint,
  href,
  onClick,
  tone = "neutral",
  testId,
  size = "primary",
}: {
  icon: RrIconName;
  label: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
  tone?: "neutral" | "positive" | "warning" | "info";
  testId?: string;
  /** INV-H5C — `primary` (large + bold) for top 4 actions, `secondary` for
   *  the smaller utility tiles row. */
  size?: "primary" | "secondary";
}) {
  const accent =
    tone === "positive" ? "bg-emerald-300/60" :
    tone === "warning"  ? "bg-amber-300/60"   :
    tone === "info"     ? "bg-blue-300/60"    :
                          "bg-white/40 dark:bg-white/30";
  const isPrimary = size === "primary";
  const inner = (
    <div
      data-testid={testId}
      className={`group relative flex h-full flex-col rounded-xl border bg-[var(--bg-surface)] transition-colors hover:bg-[var(--bg-elevated)] ${
        isPrimary
          ? "min-h-[140px] border-[var(--border-color)] px-5 py-4 shadow-sm"
          : "min-h-[80px] border-[var(--border-subtle)] px-3.5 py-3"
      }`}
    >
      <div aria-hidden className={`absolute left-4 top-0 h-px ${isPrimary ? "w-14" : "w-8"} ${accent}`} />
      <div className={`flex items-center ${isPrimary ? "gap-3" : "gap-2"}`}>
        <span
          className={`flex shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] ${
            isPrimary ? "h-11 w-11" : "h-7 w-7"
          }`}
        >
          <RrIcon name={icon} size={isPrimary ? 16 : 12} />
        </span>
        <div
          className={`font-medium tracking-tight text-[var(--text-primary)] ${
            isPrimary ? "text-[16px]" : "text-[12.5px]"
          }`}
        >
          {label}
        </div>
      </div>
      {hint && (
        <div
          className={`leading-relaxed text-[var(--text-dim)] ${
            isPrimary ? "mt-2.5 text-[12.5px]" : "mt-1.5 text-[10.5px]"
          }`}
        >
          {hint}
        </div>
      )}
      {isPrimary && (
        <div className="mt-auto pt-3 text-[11px] text-[var(--text-dim)] opacity-0 transition-opacity group-hover:opacity-100">
          →
        </div>
      )}
    </div>
  );
  if (href) return <Link href={href} className="block h-full">{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="block h-full w-full text-left">
      {inner}
    </button>
  );
}

/* ─── AlertCard ────────────────────────────────────────────── */

export function AlertCard({
  icon,
  label,
  count,
  href,
  tone = "warning",
}: {
  icon: RrIconName;
  label: string;
  count: number;
  href?: string;
  tone?: "warning" | "rose" | "info";
}) {
  const dot =
    tone === "rose" ? "bg-rose-400 dark:bg-rose-300" :
    tone === "info" ? "bg-blue-400 dark:bg-blue-300" :
                      "bg-amber-400 dark:bg-amber-300";
  const inner = (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-elevated)]">
      <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
        <RrIcon name={icon} size={12} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-[var(--text-primary)]">{label}</div>
      </div>
      <div className="text-[16px] font-medium tabular-nums text-[var(--text-primary)]">
        {count}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

/* ─── TodayTile ────────────────────────────────────────────── */

export function TodayTile({
  icon,
  label,
  value,
  href,
}: {
  icon: RrIconName;
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-elevated)]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
        <RrIcon name={icon} size={12} />
      </span>
      <div className="text-[11.5px] text-[var(--text-dim)]">{label}</div>
      <div className="ml-auto text-[16px] font-medium tabular-nums text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

/* ─── IntelTile ────────────────────────────────────────────── */

export function IntelTile({
  icon,
  label,
  primary,
  secondary,
  href,
}: {
  icon: RrIconName;
  label: string;
  primary: string;
  secondary?: string;
  href?: string;
}) {
  const inner = (
    <div className="flex h-full flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
          <RrIcon name={icon} size={11} />
        </span>
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--text-dim)]">
          {label}
        </div>
      </div>
      <div className="mt-1.5 text-[13.5px] font-medium text-[var(--text-primary)]">{primary}</div>
      {secondary && <div className="mt-0.5 text-[11px] text-[var(--text-dim)]">{secondary}</div>}
    </div>
  );
  if (href) return <Link href={href} className="block h-full">{inner}</Link>;
  return inner;
}

/* ─── LookupInput ──────────────────────────────────────────── */

export function LookupInput({
  icon,
  placeholder,
  type,
}: {
  icon: RrIconName;
  placeholder: string;
  /** Which entity tab to deep-link into (server search route accepts q). */
  type: "item" | "serial" | "batch";
}) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    /* The global search route filters server-side; route there with q + a
       focused type hint via fragment so the page can pre-collapse. */
    router.push(`/inventory/search?q=${encodeURIComponent(term)}#${type}`);
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
      <span className="text-[var(--text-dim)]"><RrIcon name={icon} size={12} /></span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="min-h-[40px] flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
      />
      <button
        type="submit"
        className="rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
      >
        <RrIcon name="search" size={11} />
      </button>
    </form>
  );
}

/* ─── BulkActionBar ────────────────────────────────────────── */

/** Sticky bottom selection bar used by every table that supports
 *  multi-row actions (movements, transfers, returns, batches). */
export function BulkActionBar({
  count,
  actions,
  onClear,
}: {
  count: number;
  actions: Array<{ label: string; icon?: RrIconName; onClick: () => void; tone?: "primary" | "danger" | "default" }>;
  onClear: () => void;
}) {
  const { t } = useTranslation(inventoryT);
  if (count <= 0) return null;
  return (
    <div
      data-testid="inv-bulk-action-bar"
      className="fixed inset-x-2 bottom-2 z-30 mx-auto flex max-w-[920px] flex-wrap items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 backdrop-blur-md px-3 py-2.5 shadow-xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <div className="text-[12px] text-[var(--text-primary)]">
        {t("inv.bulk.selected").replace("{n}", String(count))}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {actions.map((a) => {
          const cls =
            a.tone === "primary"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
              : a.tone === "danger"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
                : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]";
          return (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] ${cls}`}
            >
              {a.icon && <RrIcon name={a.icon} size={11} />}
              {a.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-2.5 py-1.5 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        >
          {t("inv.bulk.clear")}
        </button>
      </div>
    </div>
  );
}

/* ─── OperatorMovementMenu ─────────────────────────────────── */

/** The 5-verb create menu shown in headers / FABs. Replaces the
 *  technical "New Movement" button with Receive / Ship / Transfer /
 *  Adjustment / Return. Each entry routes to the right workflow page. */
export function OperatorMovementMenu({
  compact = false,
  testId,
}: { compact?: boolean; testId?: string }) {
  const { t } = useTranslation(inventoryT);
  const entries: Array<{ key: string; label: string; icon: RrIconName; href: string }> = [
    { key: "receive",  label: t("inv.action.receive"),  icon: "download",       href: "/inventory/movements?create=receive" },
    { key: "ship",     label: t("inv.action.ship"),     icon: "truck-side",     href: "/inventory/movements?create=ship" },
    { key: "transfer", label: t("inv.action.transfer"), icon: "shipping-fast",  href: "/inventory/transfers?create=1" },
    { key: "adjust",   label: t("inv.action.adjust"),   icon: "pencil",         href: "/inventory/movements?create=adjustment" },
    { key: "return",   label: t("inv.action.return"),   icon: "recycle",        href: "/inventory/returns?create=1" },
  ];
  return (
    <div data-testid={testId ?? "operator-movement-menu"} className={`flex flex-wrap items-center ${compact ? "gap-1" : "gap-1.5"}`}>
      {entries.map((e) => (
        <Link
          key={e.key}
          href={e.href}
          className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] ${compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-[12px]"}`}
        >
          <RrIcon name={e.icon} size={compact ? 11 : 12} />
          {e.label}
        </Link>
      ))}
    </div>
  );
}

/* ─── Mobile FAB ───────────────────────────────────────────── */

export function MobileFab() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation(inventoryT);
  return (
    <div data-testid="inv-mobile-fab" className="fixed bottom-20 right-4 z-30 md:hidden">
      {open && (
        <div className="mb-2 flex flex-col items-end gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2 shadow-lg">
          <FabLink href="/inventory/movements?create=receive"   icon="download"         label={t("inv.action.receive")} />
          <FabLink href="/inventory/movements?create=ship"      icon="truck-side"       label={t("inv.action.ship")} />
          <FabLink href="/inventory/transfers?create=1"         icon="shipping-fast"    label={t("inv.action.transfer")} />
          <FabLink href="/inventory/movements?create=adjustment" icon="pencil"          label={t("inv.action.adjust")} />
          <FabLink href="/inventory/returns?create=1"           icon="recycle"          label={t("inv.action.return")} />
        </div>
      )}
      <button
        type="button"
        aria-label={t("inv.mobile.create")}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--accent-primary,#fff)] text-[var(--bg-primary)] shadow-lg"
      >
        <RrIcon name={open ? "cross" : "plus"} size={16} />
      </button>
    </div>
  );
}

function FabLink({ href, icon, label }: { href: string; icon: RrIconName; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2 text-[12.5px] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
    >
      <RrIcon name={icon} size={13} /> {label}
    </Link>
  );
}

/* ─── Mobile bottom bar ────────────────────────────────────── */

export function MobileBottomBar() {
  const entries: Array<{ label: string; icon: RrIconName; href: string }> = [
    { label: "Home",      icon: "coins",        href: "/inventory" },
    { label: "Items",     icon: "box-open",     href: "/inventory/items" },
    { label: "Movements", icon: "file-invoice", href: "/inventory/movements" },
    { label: "Search",    icon: "search",       href: "/inventory/search" },
  ];
  return (
    <nav
      data-testid="inv-mobile-bottom-bar"
      aria-label="Inventory mobile nav"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] md:hidden"
    >
      {entries.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        >
          <RrIcon name={e.icon} size={13} />
          <span>{e.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/* ─── TraceabilityCard ─────────────────────────────────────── */

export interface TraceLink {
  label: string;
  value: string;
  href?: string;
  icon?: RrIconName;
}

export function TraceabilityCard({
  links,
  emptyHint,
}: {
  links: TraceLink[];
  emptyHint?: string;
}) {
  const { t } = useTranslation(inventoryT);
  return (
    <section
      data-testid="inv-trace-card"
      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-dim)]">
        {t("inv.trace.title")}
      </div>
      {links.length === 0 ? (
        <div className="mt-2 text-[11.5px] text-[var(--text-dim)]">
          {emptyHint ?? t("inv.trace.empty")}
        </div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {links.map((l, i) => (
            <li key={`${l.label}-${i}`} className="flex items-center gap-2">
              {l.icon && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-dim)]">
                  <RrIcon name={l.icon} size={11} />
                </span>
              )}
              <span className="text-[11px] uppercase tracking-[0.10em] text-[var(--text-dim)]">
                {l.label}
              </span>
              {l.href ? (
                <Link
                  href={l.href}
                  className="ml-auto truncate text-[12px] text-[var(--text-primary)] hover:underline"
                >
                  {l.value}
                </Link>
              ) : (
                <span className="ml-auto truncate text-[12px] text-[var(--text-primary)]">
                  {l.value}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─── Warning chips ────────────────────────────────────────── */

export function WarningChip({
  tone = "warning",
  icon,
  children,
}: {
  tone?: "warning" | "rose" | "info";
  icon?: RrIconName;
  children: ReactNode;
}) {
  const cls =
    tone === "rose" ? "border-rose-500/30 bg-rose-500/10 text-rose-200 dark:text-rose-200" :
    tone === "info" ? "border-blue-500/30 bg-blue-500/10 text-blue-200 dark:text-blue-200" :
                      "border-amber-500/30 bg-amber-500/10 text-amber-200 dark:text-amber-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] ${cls}`}>
      {icon && <RrIcon name={icon} size={10} />}
      {children}
    </span>
  );
}

/* ─── useInventoryShortcuts ────────────────────────────────── */

/** R/S/T/A/F keyboard shortcuts. Only attached when isActive=true
 *  (i.e. on inventory routes). Never fires while typing in an input,
 *  textarea, contenteditable, or with a modifier key held down. */
export function useInventoryShortcuts({ isActive = true }: { isActive?: boolean } = {}) {
  const router = useRouter();
  const handlersRef = useRef({
    r: () => router.push("/inventory/movements?create=receive"),
    s: () => router.push("/inventory/movements?create=ship"),
    t: () => router.push("/inventory/transfers?create=1"),
    a: () => router.push("/inventory/movements?create=adjustment"),
    f: () => router.push("/inventory/search"),
  });

  const isTypingTarget = useCallback((el: EventTarget | null): boolean => {
    if (!(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return false;
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();
      const h = handlersRef.current as Record<string, () => void>;
      if (h[key]) {
        e.preventDefault();
        h[key]();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, isTypingTarget]);
}

/* ─── Keyboard shortcuts legend (report GEN-8) ────────────────
   The R/S/T/A/F shortcuts existed but were undiscoverable and unlabelled.
   This renders a small always-visible "Shortcuts" pill (bottom-left on
   desktop) plus a legend panel that opens on click or by pressing "?".
   Mounted once in the inventory layout so it covers every inventory route.
   Hidden on touch (the shortcuts need a physical keyboard). */
const INVENTORY_SHORTCUTS: Array<{ keyLabel: string; label: string; desc: string }> = [
  { keyLabel: "R", label: "Receive", desc: "Goods in — start a receive movement" },
  { keyLabel: "S", label: "Ship",    desc: "Goods out — start a ship movement" },
  { keyLabel: "T", label: "Transfer", desc: "Move stock between warehouses" },
  { keyLabel: "A", label: "Adjust",  desc: "Manual stock adjustment" },
  { keyLabel: "F", label: "Find",    desc: "Open global inventory search" },
  { keyLabel: "?", label: "Help",    desc: "Show / hide this shortcuts list" },
];

export function InventoryShortcutsLegend() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLElement) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return;
      }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="hidden md:block">
      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 px-3 py-1.5 text-[11.5px] font-medium text-[var(--text-dim)] shadow-lg backdrop-blur-md transition-colors hover:text-[var(--text-primary)]"
        title="Keyboard shortcuts (press ?)"
        aria-expanded={open}
      >
        <kbd className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-bold">?</kbd>
        Shortcuts
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label="Keyboard shortcuts"
            className="fixed bottom-16 left-4 z-50 w-[300px] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3.5 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                Keyboard shortcuts
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <ul className="divide-y divide-[var(--border-faint)]">
              {INVENTORY_SHORTCUTS.map((s) => (
                <li key={s.keyLabel} className="flex items-center gap-3 px-3.5 py-2">
                  <kbd className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] font-bold text-[var(--text-primary)]">
                    {s.keyLabel}
                  </kbd>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">{s.label}</div>
                    <div className="truncate text-[11px] text-[var(--text-dim)]">{s.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Section eyebrow + hairline (shared) ─────────────────── */

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-dim)]">
      {children}
    </div>
  );
}

/* ─── FEFO helper (re-exported from server-safe lib) ──────── */

export { suggestFefoBatch, type FefoBatchOption as BatchOption } from "@/lib/inventory/fefo";

/* ─── useSelection ─────────────────────────────────────────── */

/** Tiny selection store for tables — used by every bulk-action page. */
export function useSelection<T extends string>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());
  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  const set = useCallback((ids: T[]) => setSelected(new Set(ids)), []);
  const has = useCallback((id: T) => selected.has(id), [selected]);
  const count = selected.size;
  const ids = useMemo(() => [...selected], [selected]);
  return { selected, ids, count, toggle, clear, set, has };
}
