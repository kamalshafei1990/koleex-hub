"use client";

/* ---------------------------------------------------------------------------
   Events — /events

   The event command centre: one bounded request on open (the list + the
   guest funnel counts + the filter counts), client-side filtering on top of
   that page — switching between All / Upcoming / Past costs one cheap
   request, searching costs nothing. No poller.

   Layout follows the AppHomeMenu convention: navItems for the filters, the
   create action in the header's `action` slot — never both.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { eventsT } from "@/lib/translations/events";
import type { EventListItem, EventStatus, EventType } from "@/lib/events/types";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/kds/EmptyState";
import EventsIcon from "@/components/icons/EventsIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import { CARD } from "@/components/events/fields";
import EventFormModal from "@/components/events/EventFormModal";
import { formatEventDate, ownerDisplayName } from "@/lib/events/types";

type Filter = "all" | "upcoming" | "past" | "archived";
const FILTERS: Filter[] = ["all", "upcoming", "past", "archived"];

export default function EventsApp() {
  const { t } = useTranslation(eventsT);
  const router = useRouter();

  const [rows, setRows] = useState<EventListItem[] | null>(null);
  const [counts, setCounts] = useState<Record<Filter, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async (f: Filter) => {
    setError(null);
    try {
      const res = await fetch(`/api/events?filter=${f}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        rows: EventListItem[];
        counts: Record<Filter, number>;
      };
      setRows(body.rows ?? []);
      setCounts(body.counts ?? null);
    } catch {
      setError(t("list.error"));
      setRows([]);
    }
  }, [t]);

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = rows ?? [];
    if (term) {
      list = list.filter((r) =>
        [r.title, r.location, r.city, r.country]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)),
      );
    }
    return list;
  }, [rows, query]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6 lg:px-8 md:py-8 !pb-16">
      <PageHeader
        title={t("app.title")}
        subtitle={t("app.subtitle")}
        icon={<EventsIcon size={22} />}
        action={
          <Button variant="primary" icon={<PlusIcon size={14} />} onClick={() => setShowNew(true)}>
            {t("menu.new")}
          </Button>
        }
      />

      {/* mt-5 mb-3: the AppHomeMenu wrapper Travel uses — without it the
          search band touches the header hero and the list below. */}
      <div className="mt-5 mb-3">
        <AppHomeMenu
          searchPlaceholder={t("app.searchPh")}
          onSearchChange={setQuery}
          navItems={[
          ...FILTERS.map((f) => ({
            icon: "calendar" as const,
            label: t(`menu.${f}`),
            count: counts?.[f],
            active: filter === f,
            onClick: () => setFilter(f),
          })),
          {
            icon: "plus" as const,
            label: t("menu.new"),
            onClick: () => setShowNew(true),
          },
        ]}
        />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-20 text-[var(--text-dim)]">
          <SpinnerIcon size={22} />
        </div>
      ) : error ? (
        <EmptyState title={error} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<EventsIcon size={36} />}
          title={t("empty.title")}
          hint={t("empty.body")}
          action={
            <Button variant="secondary" icon={<PlusIcon size={14} />} onClick={() => setShowNew(true)}>
              {t("menu.new")}
            </Button>
          }
        />
      ) : (
        /* Full-width rows, the platform's list convention (Travel and the
           other apps) — a card grid leaves half the page empty whenever the
           list is short, which is exactly what the owner flagged. */
        <div className={`${CARD} divide-y divide-[var(--border-subtle)]`}>
          {visible.map((ev) => (
            <EventRow key={ev.id} ev={ev} onOpen={() => router.push(`/events/${ev.id}`)} />
          ))}
        </div>
      )}

      <EventFormModal open={showNew} onClose={() => setShowNew(false)} onSaved={() => void load(filter)} />
    </div>
  );
}

/* ── The row ─────────────────────────────────────────────────────────────── */

function EventRow({ ev, onOpen }: { ev: EventListItem; onOpen: () => void }) {
  const { t } = useTranslation(eventsT);
  const total = Object.values(ev.guest_counts).reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0;
  const confirmed = (ev.guest_counts.accepted ?? 0) + (ev.guest_counts.attended ?? 0);
  const startLabel = formatEventDate(ev.start_at);
  const endLabel = formatEventDate(ev.end_at);
  const dateLine = startLabel
    ? endLabel && endLabel !== startLabel ? `${startLabel} → ${endLabel}` : startLabel
    : null;
  const placeLine = [ev.location, ev.city, ev.country].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-4 px-4 py-3 text-start transition-colors hover:bg-[var(--bg-surface-hover)] sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <TypePill type={ev.type} />
          <StatusPill status={ev.status} />
        </div>
        <h3 className="mt-1.5 truncate text-[14px] font-semibold group-hover:underline">
          {ev.title}
        </h3>
        <p className="mt-0.5 truncate text-[12px] tabular-nums text-[var(--text-secondary)]">
          {dateLine ?? t("ov.noDates")}
          {placeLine ? ` · ${placeLine}` : ""}
        </p>
      </div>
      <div className="hidden shrink-0 text-end text-[11px] leading-5 text-[var(--text-dim)] sm:block">
        <p>
          {total} {t("card.guests")}
          {confirmed > 0 && (
            <>
              {" · "}
              {confirmed} {t("card.confirmed")}
            </>
          )}
        </p>
        <p className="max-w-44 truncate">{ownerDisplayName(ev.owner)}</p>
      </div>
    </button>
  );
}

/* ── Pills — deliberately quiet: type is informational, status is the only
   accent, and even that stays inside the black-and-white register. ─────── */

const TYPE_STYLE: Record<EventType, string> = {
  exhibition: "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  conference: "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  launch: "border-[var(--border-strong)] text-[var(--text-highlight)]",
  mission: "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  visit: "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  training: "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  workshop: "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  seminar: "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  gathering: "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  ceremony: "border-[var(--border-strong)] text-[var(--text-highlight)]",
  roadshow: "border-[var(--border-subtle)] text-[var(--text-secondary)]",
  online: "border-dashed border-[var(--border-subtle)] text-[var(--text-secondary)]",
};

function TypePill({ type }: { type: EventType }) {
  const { t } = useTranslation(eventsT);
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_STYLE[type]}`}>
      {t(`type.${type}`)}
    </span>
  );
}

const STATUS_STYLE: Record<EventStatus, string> = {
  idea: "text-[var(--text-dim)]",
  planning: "text-[var(--text-secondary)]",
  confirmed: "text-[var(--text-highlight)]",
  live: "text-emerald-500",
  done: "text-[var(--text-dim)]",
  archived: "text-[var(--text-dim)]",
};

function StatusPill({ status }: { status: EventStatus }) {
  const { t } = useTranslation(eventsT);
  return (
    <span className={`rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLE[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}
