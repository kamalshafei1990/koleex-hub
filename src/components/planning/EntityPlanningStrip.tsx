"use client";

/* ---------------------------------------------------------------------------
   EntityPlanningStrip — compact "Scheduled" section that any entity
   detail page (Customer, Supplier, Contact, Product, …) can drop in to
   show upcoming planning items linked to that record.

     <EntityPlanningStrip entityType="customer" entityId={customer.id} />

   No props beyond the two identifiers — it handles its own fetch, empty
   state, and styling to match other Hub detail strips.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import PlanningIcon from "@/components/icons/PlanningIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import {
  fetchLinkedItems,
  formatRange,
  durationHours,
  ITEM_TYPE_COLOR,
  ITEM_TYPE_LABELS,
  type PlanningItem,
} from "@/lib/planning";

export default function EntityPlanningStrip({
  entityType,
  entityId,
  upcomingOnly = true,
  limit = 5,
  title = "Scheduled",
}: {
  entityType: string;
  entityId: string;
  upcomingOnly?: boolean;
  limit?: number;
  title?: string;
}) {
  const [items, setItems] = useState<PlanningItem[] | null>(null);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    fetchLinkedItems(entityType, entityId, { upcomingOnly }).then((rows) => {
      if (!cancelled) setItems(rows.slice(0, limit));
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, upcomingOnly, limit]);

  if (items === null) {
    return (
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 flex items-center gap-2">
        <SpinnerIcon className="h-4 w-4 text-[var(--text-dim)] animate-spin" />
        <span className="text-[12px] text-[var(--text-dim)]">
          Loading schedule…
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <PlanningIcon size={14} className="text-[var(--text-dim)]" />
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {title}
          </h3>
          <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
        <Link
          href="/planning"
          className="text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          Open
          <ExternalLinkIcon size={10} />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-5 text-[12px] text-[var(--text-dim)] text-center">
          Nothing scheduled for this record.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <div
                className="w-1 h-8 rounded-full shrink-0"
                style={{
                  background: it.role?.color ?? ITEM_TYPE_COLOR[it.type],
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                  {it.title || ITEM_TYPE_LABELS[it.type]}
                </div>
                <div className="text-[10px] text-[var(--text-dim)] truncate">
                  {formatRange(it.start_at, it.end_at)} ·{" "}
                  {durationHours(it.start_at, it.end_at)}h
                  {it.resource?.name ? ` · ${it.resource.name}` : ""}
                </div>
              </div>
              <StatusDot status={it.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: PlanningItem["status"] }) {
  const color =
    status === "draft"
      ? "bg-amber-400"
      : status === "published"
        ? "bg-emerald-400"
        : status === "completed"
          ? "bg-blue-400"
          : "bg-rose-400";
  return <span className={`h-2 w-2 rounded-full ${color} shrink-0`} />;
}
