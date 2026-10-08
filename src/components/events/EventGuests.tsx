"use client";

/* ---------------------------------------------------------------------------
   EventGuests — the guest list and its invitation answers.

   Phase 1: build the list and track answers manually (a phone call, a
   WeChat message — the record lives here). Phase 2 replaces the manual
   status with sent invitations + public RSVP links; the SAME rows and the
   SAME statuses carry over, nothing is re-entered.

   The inline status Select is the core workflow — "he just confirmed" is
   one click, no modal.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { eventsT } from "@/lib/translations/events";
import {
  GUEST_CATEGORIES,
  GUEST_STATUSES,
  type EventGuestRow,
  type GuestCategory,
  type GuestStatus,
} from "@/lib/events/types";
import Modal from "@/components/kds/Modal";
import Select from "@/components/kds/Select";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/kds/EmptyState";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CARD, SelectField, TextAreaField, TextField } from "@/components/events/fields";

/** Clipboard with the execCommand fallback — WeChat's built-in browser and
 *  some in-app webviews still deny the async API. */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall through */
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* best effort */
  }
  ta.remove();
}

interface Draft {
  name: string;
  company: string;
  email: string;
  phone: string;
  category: GuestCategory;
  status: GuestStatus;
  notes: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  company: "",
  email: "",
  phone: "",
  category: "guest",
  status: "listed",
  notes: "",
};

const STATUS_TONE: Record<GuestStatus, string> = {
  listed: "text-[var(--text-dim)]",
  invited: "text-[var(--text-secondary)]",
  viewed: "text-[var(--text-secondary)]",
  accepted: "text-emerald-500",
  declined: "text-rose-400",
  maybe: "text-amber-500",
  attended: "text-emerald-600",
};

export default function EventGuests({
  eventId,
  guests,
  onChanged,
}: {
  eventId: string;
  guests: EventGuestRow[];
  onChanged: () => void;
}) {
  const { t } = useTranslation(eventsT);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventGuestRow | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EventGuestRow | null>(null);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* Create (or refresh) the invitation, mark it sent, copy the public link.
   *  The organizer then pastes it into whatever channel the guest reads —
   *  email, WhatsApp, WeChat. The row records sent_at either way. */
  const invite = useCallback(
    async (g: EventGuestRow) => {
      if (statusBusy) return;
      setStatusBusy(g.id);
      try {
        const res = await fetch(`/api/events/${eventId}/guests/${g.id}/invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ send: true }),
        });
        if (!res.ok) return;
        const body = (await res.json()) as { invitation?: { token?: string } };
        if (body.invitation?.token) {
          const url = `${window.location.origin}/invite/${body.invitation.token}`;
          await copyText(url);
          setCopiedId(g.id);
          window.setTimeout(() => setCopiedId((id) => (id === g.id ? null : id)), 2500);
        }
        onChanged();
      } finally {
        setStatusBusy(null);
      }
    },
    [eventId, onChanged, statusBusy],
  );

  /* Copy an existing invitation's link again without touching sent state. */
  const recopy = useCallback(async (g: EventGuestRow) => {
    if (!g.invitation?.token) return;
    await copyText(`${window.location.origin}/invite/${g.invitation.token}`);
    setCopiedId(g.id);
    window.setTimeout(() => setCopiedId((id) => (id === g.id ? null : id)), 2500);
  }, []);

  const openNew = useCallback(() => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((g: EventGuestRow) => {
    setEditing(g);
    setDraft({
      name: g.name,
      company: g.company ?? "",
      email: g.email ?? "",
      phone: g.phone ?? "",
      category: g.category,
      status: g.status,
      notes: g.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }, []);

  const save = useCallback(async () => {
    if (!draft.name.trim()) {
      setError(t("g.nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: draft.name,
        company: draft.company || null,
        email: draft.email || null,
        phone: draft.phone || null,
        category: draft.category,
        status: draft.status,
        notes: draft.notes || null,
      };
      const res = editing
        ? await fetch(`/api/events/${eventId}/guests/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/events/${eventId}/guests`, {
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
      const res = await fetch(`/api/events/${eventId}/guests/${pendingDelete.id}`, {
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

  /** The one-click answer change — the reason this tab exists. */
  const changeStatus = useCallback(
    async (g: EventGuestRow, status: GuestStatus) => {
      if (status === g.status) return;
      setStatusBusy(g.id);
      try {
        await fetch(`/api/events/${eventId}/guests/${g.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        onChanged();
      } finally {
        setStatusBusy(null);
      }
    },
    [eventId, onChanged],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return guests;
    return guests.filter((g) =>
      [g.name, g.company, g.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [guests, query]);

  const total = guests.length;
  const confirmed = guests.filter((g) => g.status === "accepted" || g.status === "attended").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("g.searchPh")}
          className="h-8 min-w-52 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 text-[13px] text-[var(--text-primary)] outline-none sm:flex-none"
        />
        <span className="text-[12px] text-[var(--text-dim)]">
          {total} {t("card.guests")} · {confirmed} {t("card.confirmed")}
        </span>
        <Button variant="primary" size="sm" icon={<UserPlusIcon size={14} />} onClick={openNew}>
          {t("g.add")}
        </Button>
      </div>

      {guests.length === 0 ? (
        <EmptyState
          title={t("g.empty")}
          hint={t("g.emptyHint")}
          action={
            <Button variant="secondary" size="sm" icon={<UserPlusIcon size={14} />} onClick={openNew}>
              {t("g.add")}
            </Button>
          }
        />
      ) : (
        <div className={`${CARD} divide-y divide-[var(--border-subtle)]`}>
          {visible.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <div className="min-w-40 flex-1">
                <p className="text-[13px] font-medium">{g.name}</p>
                <p className="text-[11px] text-[var(--text-dim)]">
                  {[g.company, t(`cat.${g.category}`)].filter(Boolean).join(" · ")}
                  {g.invitation && (
                    <>
                      {" · "}
                      {t(`ist.${g.invitation.status}`)}
                    </>
                  )}
                </p>
              </div>
              {g.email && <span className="hidden text-[11px] text-[var(--text-dim)] md:block">{g.email}</span>}
              <Select
                value={g.status}
                onChange={(v) => void changeStatus(g, v as GuestStatus)}
                options={GUEST_STATUSES.map((s) => ({ value: s, label: t(`gst.${s}`) }))}
                triggerClassName={`h-7 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2 text-[11px] font-medium ${STATUS_TONE[g.status]} ${statusBusy === g.id ? "opacity-50" : ""}`}
              />
              <div className="flex items-center gap-1">
                {copiedId === g.id ? (
                  <span className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-emerald-500">
                    <CheckIcon size={13} />
                    {t("g.copied")}
                  </span>
                ) : g.invitation ? (
                  <button
                    type="button"
                    aria-label={t("g.inviteAgain")}
                    title={t("g.inviteAgain")}
                    onClick={() => void recopy(g)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                  >
                    <CopyIcon size={13} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void invite(g)}
                    disabled={statusBusy !== null}
                    className="h-7 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-highlight)] disabled:opacity-50"
                  >
                    {t("g.invite")}
                  </button>
                )}
                <button
                  type="button"
                  aria-label={t("common.edit")}
                  onClick={() => openEdit(g)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                >
                  <PencilIcon size={13} />
                </button>
                <button
                  type="button"
                  aria-label={t("common.remove")}
                  onClick={() => setPendingDelete(g)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-rose-400"
                >
                  <TrashIcon size={13} />
                </button>
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="px-4 py-8 text-center text-[12px] text-[var(--text-dim)]">
              {t("g.searchPh")}
            </p>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t("g.edit") : t("g.add")}
        maxWidth="max-w-xl"
        actions={
          <>
            <Button variant="primary" loading={busy} onClick={save}>
              {t("g.save")}
            </Button>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={t("g.name")} value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder={t("g.namePh")} wide />
          <TextField label={t("g.company")} value={draft.company} onChange={(v) => setDraft((d) => ({ ...d, company: v }))} />
          <SelectField<GuestCategory>
            label={t("g.category")}
            value={draft.category}
            onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            options={GUEST_CATEGORIES.map((c) => ({ value: c, label: t(`cat.${c}`) }))}
          />
          <SelectField<GuestStatus>
            label={t("g.status")}
            value={draft.status}
            onChange={(v) => setDraft((d) => ({ ...d, status: v }))}
            options={GUEST_STATUSES.map((s) => ({ value: s, label: t(`gst.${s}`) }))}
          />
          <TextField label={t("g.email")} value={draft.email} onChange={(v) => setDraft((d) => ({ ...d, email: v }))} />
          <TextField label={t("g.phone")} value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} />
          <TextAreaField label={t("g.notes")} value={draft.notes} onChange={(v) => setDraft((d) => ({ ...d, notes: v }))} rows={2} />
        </div>
        {error && <p className="text-[12px] text-rose-400">{error}</p>}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={t("g.deleteTitle")}
        description={pendingDelete ? t("g.deleteBody").replace("{name}", pendingDelete.name) : undefined}
        confirmLabel={t("common.remove")}
        destructive
      />
    </div>
  );
}
