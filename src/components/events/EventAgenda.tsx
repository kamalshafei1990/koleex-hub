"use client";

/* ---------------------------------------------------------------------------
   EventAgenda — the day's program, ordered. Sessions with a start time are
   also mirrored onto the event owner's calendar (calendar-feed), so the
   program a person is running shows where they actually look.

   Times display in the viewer's own zone; stored as instants.
   --------------------------------------------------------------------------- */

import { useCallback, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { eventsT } from "@/lib/translations/events";
import type { EventAgendaItemRow } from "@/lib/events/types";
import Modal from "@/components/kds/Modal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/kds/EmptyState";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CARD, DateTimeField, TextAreaField, TextField } from "@/components/events/fields";

interface Draft {
  title: string;
  speaker: string;
  location: string;
  starts_at: string | null;
  ends_at: string | null;
  description: string;
}

const EMPTY_DRAFT: Draft = {
  title: "",
  speaker: "",
  location: "",
  starts_at: null,
  ends_at: null,
  description: "",
};

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function EventAgenda({
  eventId,
  agenda,
  onChanged,
}: {
  eventId: string;
  agenda: EventAgendaItemRow[];
  onChanged: () => void;
}) {
  const { t } = useTranslation(eventsT);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventAgendaItemRow | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EventAgendaItemRow | null>(null);

  const openNew = useCallback(() => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((a: EventAgendaItemRow) => {
    setEditing(a);
    setDraft({
      title: a.title,
      speaker: a.speaker ?? "",
      location: a.location ?? "",
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      description: a.description ?? "",
    });
    setError(null);
    setModalOpen(true);
  }, []);

  const save = useCallback(async () => {
    if (!draft.title.trim()) {
      setError(t("a.titleRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: draft.title,
        speaker: draft.speaker || null,
        location: draft.location || null,
        starts_at: draft.starts_at,
        ends_at: draft.ends_at,
        description: draft.description || null,
      };
      const res = editing
        ? await fetch(`/api/events/${eventId}/agenda/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/events/${eventId}/agenda`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (res.ok) {
        setModalOpen(false);
        onChanged();
        return;
      }
      const bodyJson = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(bodyJson?.error ?? `HTTP ${res.status}`);
    } finally {
      setBusy(false);
    }
  }, [draft, editing, eventId, onChanged, t]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/agenda/${pendingDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPendingDelete(null);
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }, [pendingDelete, eventId, onChanged]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="primary" size="sm" icon={<PlusIcon size={14} />} onClick={openNew}>
          {t("a.add")}
        </Button>
      </div>

      {agenda.length === 0 ? (
        <EmptyState
          title={t("a.empty")}
          hint={t("a.emptyHint")}
          action={
            <Button variant="secondary" size="sm" icon={<PlusIcon size={14} />} onClick={openNew}>
              {t("a.add")}
            </Button>
          }
        />
      ) : (
        <div className={`${CARD} divide-y divide-[var(--border-subtle)]`}>
          {agenda.map((a) => (
            <div key={a.id} className="flex items-start gap-4 px-4 py-3">
              <div className="w-24 shrink-0 whitespace-nowrap pt-0.5 text-[12px] tabular-nums text-[var(--text-secondary)]">
                {a.starts_at ? (
                  <>
                    {timeLabel(a.starts_at)}
                    {a.ends_at && <span className="text-[var(--text-dim)]"> → {timeLabel(a.ends_at)}</span>}
                  </>
                ) : (
                  <span className="text-[var(--text-dim)]">—</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{a.title}</p>
                <p className="text-[11px] text-[var(--text-dim)]">
                  {[a.speaker, a.location].filter(Boolean).join(" · ")}
                </p>
                {a.description && (
                  <p className="mt-1 whitespace-pre-wrap text-[12px] text-[var(--text-secondary)]">
                    {a.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={t("common.edit")}
                  onClick={() => openEdit(a)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                >
                  <PencilIcon size={13} />
                </button>
                <button
                  type="button"
                  aria-label={t("common.delete")}
                  onClick={() => setPendingDelete(a)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-rose-400"
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t("a.edit") : t("a.add")}
        maxWidth="max-w-xl"
        actions={
          <>
            <Button variant="primary" loading={busy} onClick={save}>
              {t("a.save")}
            </Button>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label={t("a.title")}
            value={draft.title}
            onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
            placeholder={t("a.titlePh")}
            wide
          />
          <TextField
            label={t("a.speaker")}
            value={draft.speaker}
            onChange={(v) => setDraft((d) => ({ ...d, speaker: v }))}
          />
          <TextField
            label={t("a.location")}
            value={draft.location}
            onChange={(v) => setDraft((d) => ({ ...d, location: v }))}
          />
          <DateTimeField
            label={t("a.starts")}
            value={draft.starts_at}
            onChange={(iso) => setDraft((d) => ({ ...d, starts_at: iso }))}
          />
          <DateTimeField
            label={t("a.ends")}
            value={draft.ends_at}
            onChange={(iso) => setDraft((d) => ({ ...d, ends_at: iso }))}
          />
          <TextAreaField
            label={t("a.description")}
            value={draft.description}
            onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
            rows={2}
          />
        </div>
        {error && <p className="text-[12px] text-rose-400">{error}</p>}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={t("a.deleteTitle")}
        description={pendingDelete ? t("a.deleteBody").replace("{title}", pendingDelete.title) : undefined}
        confirmLabel={t("common.delete")}
        destructive
      />
    </div>
  );
}
