"use client";

/* ---------------------------------------------------------------------------
   InventoryUi — shared visual primitives for the Inventory app.

   Centralises movement-type humanisation, status badges, type chips,
   location-type chips, and the type-icon resolver so every page uses
   the same vocabulary. Kept deliberately small — every helper here
   maps a domain enum to a presentation element and nothing else.
   --------------------------------------------------------------------------- */

import type { ReactNode } from "react";
import type { ColorToken, IconName, LocationType, MovementType } from "@/lib/inventory/types";
import BoxIcon         from "@/components/icons/ui/BoxIcon";
import PackageIcon     from "@/components/icons/ui/PackageIcon";
import CogIcon         from "@/components/icons/ui/CogIcon";
import WrenchIcon      from "@/components/icons/ui/WrenchIcon";
import PenToolIcon     from "@/components/icons/ui/PenToolIcon";
import TagsIcon        from "@/components/icons/ui/TagsIcon";
import FileIcon        from "@/components/icons/ui/FileIcon";
import BookOpenIcon    from "@/components/icons/ui/BookOpenIcon";
import MonitorIcon     from "@/components/icons/ui/MonitorIcon";
import TruckIcon       from "@/components/icons/ui/TruckIcon";
import WarehouseIcon   from "@/components/icons/ui/WarehouseIcon";
import StarIcon        from "@/components/icons/ui/StarIcon";
import LayersIcon      from "@/components/icons/ui/LayersIcon";
import ShieldIcon      from "@/components/icons/ui/ShieldIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import BoxesIcon       from "@/components/icons/ui/BoxesIcon";
import InboxRawIcon    from "@/components/icons/ui/InboxRawIcon";
import CircleDotIcon   from "@/components/icons/ui/CircleDotIcon";
import ClockIcon       from "@/components/icons/ui/ClockIcon";
import CheckIcon       from "@/components/icons/ui/CheckIcon";
import CheckCheckIcon  from "@/components/icons/ui/CheckCheckIcon";
import BanIcon         from "@/components/icons/ui/BanIcon";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

/* ─── Tone (color token → tailwind classes) ──────────────────── */

export const COLOR_TONE: Record<ColorToken, { chip: string; dot: string; text: string }> = {
  gray:   { chip: "border-gray-500/30 bg-gray-500/10 text-gray-300",         dot: "bg-gray-400",       text: "text-gray-300" },
  blue:   { chip: "border-blue-500/30 bg-blue-500/10 text-blue-200",         dot: "bg-blue-400",       text: "text-blue-200" },
  cyan:   { chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",         dot: "bg-cyan-400",       text: "text-cyan-200" },
  teal:   { chip: "border-teal-500/30 bg-teal-500/10 text-teal-200",         dot: "bg-teal-400",       text: "text-teal-200" },
  green:  { chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", dot: "bg-emerald-400",   text: "text-emerald-200" },
  amber:  { chip: "border-amber-500/30 bg-amber-500/10 text-amber-200",       dot: "bg-amber-400",      text: "text-amber-200" },
  orange: { chip: "border-orange-500/30 bg-orange-500/10 text-orange-200",    dot: "bg-orange-400",     text: "text-orange-200" },
  red:    { chip: "border-rose-500/30 bg-rose-500/10 text-rose-200",          dot: "bg-rose-400",       text: "text-rose-200" },
  rose:   { chip: "border-rose-500/30 bg-rose-500/10 text-rose-200",          dot: "bg-rose-400",       text: "text-rose-200" },
  purple: { chip: "border-purple-500/30 bg-purple-500/10 text-purple-200",    dot: "bg-purple-400",     text: "text-purple-200" },
  violet: { chip: "border-violet-500/30 bg-violet-500/10 text-violet-200",    dot: "bg-violet-400",     text: "text-violet-200" },
  slate:  { chip: "border-slate-500/30 bg-slate-500/10 text-slate-300",       dot: "bg-slate-400",      text: "text-slate-300" },
};

/* ─── Movement type labels ─────────────────────────────────────
   Maps the lower_snake_case enum stored in the DB to a friendly
   label and a tonal hint for the UI. Keeps page components free
   of repeated switch statements.                                       */

/* INV-H5C — operator-first labels. Replaces the raw DB enum names
   (adjustment_in / transfer_out / sales_shipment / …) with plain English
   the warehouse clerk actually uses. The enum values themselves don't
   change — only their on-screen labels. */
const MOVEMENT_TYPE_META: Record<MovementType, { label: string; tone: "in" | "out" | "neutral" }> = {
  opening_balance:  { label: "Opening Stock",      tone: "in" },
  purchase_receipt: { label: "Goods Received",     tone: "in" },
  sales_shipment:   { label: "Goods Shipped",      tone: "out" },
  adjustment_in:    { label: "Stock Added",        tone: "in" },
  adjustment_out:   { label: "Stock Removed",      tone: "out" },
  transfer_in:      { label: "Warehouse Transfer", tone: "in" },
  transfer_out:     { label: "Warehouse Transfer", tone: "out" },
  return_in:        { label: "Customer Return",    tone: "in" },
  return_out:       { label: "Supplier Return",    tone: "out" },
  manual:           { label: "Adjustment",         tone: "neutral" },
};
export function movementLabel(type: string | MovementType): string {
  return MOVEMENT_TYPE_META[type as MovementType]?.label ?? type;
}

/* ─── Location type labels + tone ──────────────────────────────
   Inventory locations have grown beyond just physical warehouses
   (port, forwarder, customer_location, exhibition, …). This map
   keeps display consistent. The LocationType union itself lives in
   @/lib/inventory/types so server + client agree. */

const LOCATION_META: Record<LocationType, { label: string; color: ColorToken }> = {
  warehouse:           { label: "Warehouse",     color: "slate" },
  supplier_location:   { label: "Supplier",      color: "amber" },
  port:                { label: "Port",          color: "blue" },
  forwarder:           { label: "Forwarder",     color: "cyan" },
  consolidation_point: { label: "Consolidation", color: "teal" },
  in_transit:          { label: "In Transit",    color: "purple" },
  customer_location:   { label: "Customer",      color: "rose" },
  exhibition_site:     { label: "Exhibition",    color: "violet" },
  demo_location:       { label: "Demo",          color: "orange" },
  virtual_location:    { label: "Virtual",       color: "gray" },
};

export function LocationTypeChip({ type }: { type: string | null | undefined }) {
  const key = (type ?? "warehouse") as LocationType;
  const meta = LOCATION_META[key] ?? LOCATION_META.warehouse;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] ${COLOR_TONE[meta.color].chip}`}>
      {meta.label}
    </span>
  );
}

/* ─── Status badge ─────────────────────────────────────────────
   Shared by movements (draft/posted/voided) and items
   (active/inactive/archived). */

/* Status → small leading glyph. Maps the most common workflow statuses
   across items / movements / transfers / returns to a recognisable shape
   so operators can scan a column without parsing the text. */
function StatusGlyph({ status, size = 10 }: { status: string; size?: number }) {
  const s = status.toLowerCase();
  if (s === "posted" || s === "active" || s === "approved" || s === "completed") return <CheckIcon size={size} />;
  if (s === "received" || s === "closed") return <CheckCheckIcon size={size} />;
  if (s === "shipped" || s === "in_transit" || s === "in transit") return <TruckIcon size={size} />;
  if (s === "voided" || s === "cancelled" || s === "canceled" || s === "archived") return <BanIcon size={size} />;
  if (s === "pending" || s === "draft" || s === "inactive" || s === "approval_required" || s === "submitted") return <ClockIcon size={size} />;
  return <CircleDotIcon size={size} />;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "posted"   || s === "active"   || s === "approved" || s === "completed" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" :
    s === "received" || s === "closed"   || s === "shipped"  || s === "in_transit" ? "border-sky-400/30 bg-sky-500/10 text-sky-200" :
    s === "voided"   || s === "archived" || s === "cancelled" || s === "canceled"  ? "border-gray-500/30 bg-gray-500/10 text-gray-400" :
    s === "draft"    || s === "inactive" || s === "pending"   || s === "approval_required" || s === "submitted" ? "border-amber-400/30 bg-amber-500/10 text-amber-200" :
                                                                                     "border-white/[0.10] bg-white/[0.04] text-gray-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.10em] ${cls}`}>
      <span aria-hidden className="opacity-80"><StatusGlyph status={status} /></span>
      {status}
    </span>
  );
}

/* ─── Type chip (icon + label) ─────────────────────────────────
   Used in the Items table and in pickers so the user can scan by
   colour + glyph rather than text alone. */

const ICON_MAP: Record<IconName, (p: { size?: number; className?: string }) => ReactNode> = {
  box:       BoxIcon,
  package:   PackageIcon,
  machine:   CogIcon,
  cog:       CogIcon,
  wrench:    WrenchIcon,
  tool:      PenToolIcon,
  tag:       TagsIcon,
  label:     TagsIcon,
  file:      FileIcon,
  book:      BookOpenIcon,
  screen:    MonitorIcon,
  monitor:   MonitorIcon,
  truck:     TruckIcon,
  pallet:    BoxesIcon,
  warehouse: WarehouseIcon,
  sample:    StarIcon,
  warning:   TriangleWarningIcon,
  recycle:   InboxRawIcon,
  office:    FileIcon,
  gift:      StarIcon,
  star:      StarIcon,
  cube:      BoxIcon,
  layers:    LayersIcon,
  cable:     CogIcon,
  motor:     CogIcon,
  shield:    ShieldIcon,
  other:     BoxIcon,
};

export function TypeIcon({ icon, color, size = 12 }: { icon: IconName; color: ColorToken; size?: number }) {
  const I = ICON_MAP[icon] ?? BoxIcon;
  return (
    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${COLOR_TONE[color].chip}`}>
      <I size={size} />
    </span>
  );
}

export function TypeChip({
  name, icon, color, compact = false,
}: { name: string; icon: IconName; color: ColorToken; compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <TypeIcon icon={icon} color={color} size={10} />
        <span className="text-[11.5px] text-gray-300">{name}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.10em] ${COLOR_TONE[color].chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${COLOR_TONE[color].dot}`} />
      {name}
    </span>
  );
}

/* ─── Direction arrow (in/out) ────────────────────────────────── */

export function DirectionDelta({ direction, quantity, unit }: { direction: "in" | "out"; quantity: number; unit?: string | null }) {
  const fmt = Number(quantity ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 });
  const cls = direction === "in" ? "text-emerald-300" : "text-rose-300";
  const sign = direction === "in" ? "+" : "−";
  return (
    <span className={`inline-flex items-baseline gap-0.5 tabular-nums font-mono ${cls}`}>
      <span>{sign}{fmt}</span>
      {unit && <span className="text-[10px] text-gray-500">{unit}</span>}
    </span>
  );
}

/* ─── Small empty-state block ──────────────────────────────────
   Replaces the recurring "No rows" one-liners. Provides a heading,
   short hint, and an optional CTA — much friendlier than a centered
   `—`. */

export function InventoryEmpty({
  title, hint, action, icon,
}: { title: string; hint?: string; action?: ReactNode; icon?: RrIconName }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-gray-500">
        {icon ? <RrIcon name={icon} size={16} /> : <BoxIcon size={16} />}
      </div>
      <div className="text-[12.5px] text-gray-300">{title}</div>
      {hint && <div className="max-w-sm text-[11px] text-gray-500">{hint}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ─── Page title icon ────────────────────────────────────────────
   Small icon badge to prefix page titles. Used in section headers /
   detail-page subsections that don't sit in the InventoryHeader. */
export function PageTitleIcon({ icon, size = 14 }: { icon: RrIconName; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)]"
    >
      <RrIcon name={icon} size={size} />
    </span>
  );
}

/* ─── Section card ────────────────────────────────────────────
   Light wrapper used by table panels for a consistent look. */

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.012] ${className}`}>
      {children}
    </div>
  );
}

/* ─── Header KPI card ─────────────────────────────────────────
   Used by the dashboard. Mirrors Finance's KPI grid shape but
   keeps the inventory module visually independent. */

export function InventoryKpi({
  label, value, hint, tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "warning" | "info";
}) {
  const accent =
    tone === "positive" ? "bg-emerald-300/50" :
    tone === "warning"  ? "bg-amber-300/50"   :
    tone === "info"     ? "bg-blue-300/50"    :
                          "bg-white/30";
  return (
    <div className="relative rounded-xl border border-white/[0.05] bg-white/[0.012] px-4 py-3.5">
      <div aria-hidden className={`absolute left-4 top-0 h-px w-8 ${accent}`} />
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500">{label}</div>
      <div className="mt-2 text-[24px] font-medium leading-none tabular-nums tracking-[-0.01em]">{value}</div>
      {hint && <div className="mt-1.5 text-[10.5px] text-gray-600">{hint}</div>}
    </div>
  );
}
