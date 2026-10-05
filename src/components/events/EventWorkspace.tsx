"use client";

/* ---------------------------------------------------------------------------
   EventWorkspace — /events/[id]

   ONE request on open (event + guests + agenda together — the China-latency
   rule: no per-tab waterfalls). Tabs are client state over that single
   payload; every mutation reuses the same endpoint.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { eventsT } from "@/lib/translations/events";
import type { EventDetail } from "@/lib/events/types";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/kds/EmptyState";
import EventsIcon from "@/components/icons/EventsIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EventFormModal from "@/components/events/EventFormModal";
import EventOverview from "@/components/events/EventOverview";
import EventGuests from "@/components/events/EventGuests";
import EventAgenda from "@/components/events/EventAgenda";
import EventCheckin from "@/components/events/EventCheckin";
import EventBudget from "@/components/events/EventBudget";
import EventPostEvent from "@/components/events/EventPostEvent";

type Tab = "overview" | "guests" | "agenda" | "checkin" | "budget" | "post";

export default function EventWorkspace({ id }: { id: string }) {
  const { t } = useTranslation(eventsT);
  const router = useRouter();

  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* The calendar mirror deep-links with ?tab=agenda — read it once from the
   * URL (window, not useSearchParams: this screen is fully client-side and
   * this avoids the prerender Suspense requirement entirely). */
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "overview";
    const v = new URLSearchParams(window.location.search).get("tab");
    return v === "guests" || v === "agenda" || v === "checkin" || v === "budget" || v === "post" ? v : "overview";
  });
  const [showEdit, setShowEdit] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/events/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setError(t("list.error"));
        setDetail(null);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { event: EventDetail };
      setDetail(body.event);
    } catch {
      setError(t("list.error"));
      setDetail(null);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = useCallback(async () => {
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/events");
    } finally {
      setDeleteBusy(false);
      setPendingDelete(false);
    }
  }, [id, router]);

  if (error && !detail) {
    return (
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          icon={<EventsIcon size={36} />}
          title={error}
          action={
            <Button variant="secondary" onClick={() => router.push("/events")}>
              ← {t("app.title")}
            </Button>
          }
        />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex justify-center py-24 text-[var(--text-dim)]">
        <SpinnerIcon size={22} />
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-6 md:px-6 lg:px-8 md:py-8 !pb-16">
      <PageHeader
        title={detail.title}
        subtitle={`${t(`type.${detail.type}`)} · ${t(`status.${detail.status}`)}`}
        icon={<EventsIcon size={22} />}
        backHref="/events"
        backLabel={t("app.title")}
        action={
          <>
            <Button variant="secondary" icon={<PencilIcon size={14} />} onClick={() => setShowEdit(true)}>
              {t("common.edit")}
            </Button>
            <Button variant="ghost" icon={<TrashIcon size={14} />} onClick={() => setPendingDelete(true)}>
              {t("common.delete")}
            </Button>
          </>
        }
        tabs={[
          { key: "overview", label: t("tab.overview"), onClick: () => setTab("overview"), active: tab === "overview" },
          {
            key: "guests",
            label: t("tab.guests"),
            badge: detail.guests.length,
            onClick: () => setTab("guests"),
            active: tab === "guests",
          },
          {
            key: "agenda",
            label: t("tab.agenda"),
            badge: detail.agenda.length,
            onClick: () => setTab("agenda"),
            active: tab === "agenda",
          },
          {
            key: "checkin",
            label: t("tab.checkin"),
            badge: detail.guests.filter((g) => g.checked_in_at).length || undefined,
            onClick: () => setTab("checkin"),
            active: tab === "checkin",
          },
          {
            key: "budget",
            label: t("tab.budget"),
            onClick: () => setTab("budget"),
            active: tab === "budget",
          },
          {
            key: "post",
            label: t("tab.post"),
            onClick: () => setTab("post"),
            active: tab === "post",
          },
        ]}
      />

      {tab === "overview" && <EventOverview detail={detail} />}
      {tab === "guests" && (
        <EventGuests eventId={detail.id} guests={detail.guests} onChanged={load} />
      )}
      {tab === "agenda" && (
        <EventAgenda eventId={detail.id} agenda={detail.agenda} onChanged={load} />
      )}
      {tab === "checkin" && (
        <EventCheckin eventId={detail.id} guests={detail.guests} onChanged={load} />
      )}
      {tab === "budget" && (
        <EventBudget eventId={detail.id} budget={detail.budget} onChanged={load} />
      )}
      {tab === "post" && <EventPostEvent detail={detail} />}

      <EventFormModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        event={detail}
        onSaved={load}
      />
      <ConfirmDialog
        open={pendingDelete}
        onCancel={() => setPendingDelete(false)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
        title={t("ev.deleteTitle")}
        description={t("ev.deleteBody")}
        confirmLabel={t("common.delete")}
        destructive
      />
    </div>
  );
}
