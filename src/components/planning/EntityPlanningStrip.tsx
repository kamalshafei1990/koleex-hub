"use client";

/* ---------------------------------------------------------------------------
   EntityPlanningStrip — compact "Scheduled" section that any entity
   detail page (Customer, Supplier, Contact, Product, Project, …) can drop
   in to show upcoming planning items linked to that record.

     <EntityPlanningStrip entityType="customer" entityId={customer.id} />

   It handles its own fetch (no-store — an item saved seconds ago must
   show), loading, error and empty states. Each row deep-links into the
   Planning app with ?item=<id>, which opens that item's modal. Times read
   on the planner's clock (lib/planning-tz), like the Planning app itself.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import PlanningIcon from "@/components/icons/PlanningIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import {
  fetchLinkedItems,
  formatRange,
  durationHours,
  ITEM_TYPE_COLOR,
  ITEM_TYPE_LABELS,
  type PlanningItem,
} from "@/lib/planning";
import { useTranslation } from "@/lib/i18n";
import { planningT } from "@/lib/translations/planning";
import { usePlannerTimeZone } from "@/lib/planning-tz";

export default function EntityPlanningStrip({
  entityType,
  entityId,
  upcomingOnly = true,
  limit = 5,
  title,
}: {
  entityType: string;
  entityId: string;
  upcomingOnly?: boolean;
  limit?: number;
  title?: string;
}) {
  const { t } = useTranslation(planningT);
  const tz = usePlannerTimeZone();
  /* Stamped with the key it answered, so a stale answer for a previous
     record never shows under a new one (and no setState-in-effect reset). */
  const reqKey = `${entityType}|${entityId}|${upcomingOnly ? 1 : 0}|${limit}`;
  const [state, setState] = useState<{ k: string; items: PlanningItem[] | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    fetchLinkedItems(entityType, entityId, { upcomingOnly, limit }).then(
      (rows) => { if (!cancelled) setState({ k: reqKey, items: rows.slice(0, limit), failed: false }); },
      () => { if (!cancelled) setState({ k: reqKey, items: null, failed: true }); },
    );
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, upcomingOnly, limit, reqKey]);

  const current = state && state.k === reqKey ? state : null;
  const heading = title ?? t("strip.title");

  if (!current) {
    return (
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 flex items-center gap-2">
        <SpinnerIcon className="h-4 w-4 text-[var(--text-dim)]" />
        <span className="text-[12px] text-[var(--text-dim)]">{t("strip.loading")}</span>
      </div>
    );
  }

  const items = current.items ?? [];

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <PlanningIcon size={14} className="text-[var(--text-dim)]" />
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {heading}
          </h3>
          {!current.failed && (
            <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full">
              {items.length}
            </span>
          )}
        </div>
        <Link
          href="/planning"
          className="text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          {t("strip.open")}
          <ExternalLinkIcon size={10} className="rtl:-scale-x-100" />
        </Link>
      </div>

      {current.failed ? (
        <div role="alert" className="px-4 py-5 text-[12px] text-red-600 dark:text-red-400 text-center">
          {t("err.load")}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-5 text-[12px] text-[var(--text-dim)] text-center">
          {t("strip.empty")}
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {items.map((it) => (
            <Link
              key={it.id}
              href={`/planning?item=${encodeURIComponent(it.id)}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-surface-subtle)] transition-colors"
            >
              <div
                className="w-1 h-8 rounded-full shrink-0"
                style={{ background: it.role?.color ?? ITEM_TYPE_COLOR[it.type] }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                  {it.title || t(`type.${it.type}`, ITEM_TYPE_LABELS[it.type])}
                </div>
                <div className="text-[10px] text-[var(--text-dim)] truncate">
                  {formatRange(it.start_at, it.end_at, tz)} ·{" "}
                  {durationHours(it.start_at, it.end_at)}
                  {t("unit.h")}
                  {it.resource?.name ? ` · ${it.resource.name}` : ""}
                </div>
              </div>
              <StatusDot status={it.status} label={t(`status.${it.status}`)} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status, label }: { status: PlanningItem["status"]; label: string }) {
  const color =
    status === "draft"
      ? "bg-amber-400"
      : status === "published"
        ? "bg-emerald-400"
        : status === "completed"
          ? "bg-blue-400"
          : "bg-rose-400";
  return <span role="img" aria-label={label} title={label} className={`h-2 w-2 rounded-full ${color} shrink-0`} />;
}
