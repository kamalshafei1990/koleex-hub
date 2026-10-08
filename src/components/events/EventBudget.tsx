"use client";

/* ---------------------------------------------------------------------------
   EventBudget — the event's money, line by line. Planned vs actual with a
   variance per line, and a summary row against the event's own budget_total
   so "are we over?" is answered at the top, not discovered after.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { eventsT } from "@/lib/translations/events";
import {
  BUDGET_CATEGORIES,
  type BudgetCategory,
  type EventBudgetLineRow,
} from "@/lib/events/types";
import Modal from "@/components/kds/Modal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/kds/EmptyState";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CARD, SelectField, TextAreaField, TextField } from "@/components/events/fields";

interface Draft {
  label: string;
  category: BudgetCategory;
  planned: string;
  actual: string;
  notes: string;
}

const EMPTY_DRAFT: Draft = { label: "", category: "booth", planned: "", actual: "", notes: "" };

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function EventBudget({
  eventId,
  budget,
  onChanged,
}: {
  eventId: string;
  budget: EventBudgetLineRow[];
  onChanged: () => void;
}) {
  const { t } = useTranslation(eventsT);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventBudgetLineRow | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EventBudgetLineRow | null>(null);

  const openNew = useCallback(() => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((l: EventBudgetLineRow) => {
    setEditing(l);
    setDraft({
      label: l.label,
      category: l.category,
      planned: l.planned ? String(l.planned) : "",
      actual: l.actual ? String(l.actual) : "",
      notes: l.notes ?? "",
    });
    setError(null);
    setModalOpen(true);
  }, []);

  const save = useCallback(async () => {
    if (!draft.label.trim()) {
      setError(t("b.labelRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        label: draft.label,
        category: draft.category,
        planned: draft.planned === "" ? 0 : Number(draft.planned),
        actual: draft.actual === "" ? 0 : Number(draft.actual),
        notes: draft.notes || null,
      };
      const res = editing
        ? await fetch(`/api/events/${eventId}/budget/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch(`/api/events/${eventId}/budget`, {
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
      const res = await fetch(`/api/events/${eventId}/budget/${pendingDelete.id}`, {
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

  const totals = useMemo(() => {
    const planned = budget.reduce((a, l) => a + (l.planned ?? 0), 0);
    const actual = budget.reduce((a, l) => a + (l.actual ?? 0), 0);
    return { planned, actual };
  }, [budget]);

  /* The planned lines ARE the budget — the form no longer carries a separate
   * budget number, so remaining is measured against the plan itself. */
  const reference = totals.planned;
  const remaining = reference - totals.actual;
  const over = remaining < 0;

  return (
    <div className="space-y-3">
      {/* summary */}
      <div className={`${CARD} grid grid-cols-3 divide-x divide-[var(--border-subtle)] text-center`}>
        <div className="px-2 py-4">
          <p className="text-[18px] font-bold tabular-nums">{fmt(totals.planned)}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{t("b.totalPlanned")}</p>
        </div>
        <div className="px-2 py-4">
          <p className="text-[18px] font-bold tabular-nums">{fmt(totals.actual)}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{t("b.totalActual")}</p>
        </div>
        <div className="px-2 py-4">
          <p className={`text-[18px] font-bold tabular-nums ${over ? "text-rose-400" : "text-emerald-500"}`}>
            {fmt(Math.abs(remaining))}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-dim)]">
            {over ? t("b.over") : t("b.remaining")}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" size="sm" icon={<PlusIcon size={14} />} onClick={openNew}>
          {t("b.add")}
        </Button>
      </div>

      {budget.length === 0 ? (
        <EmptyState
          title={t("b.empty")}
          hint={t("b.emptyHint")}
          action={
            <Button variant="secondary" size="sm" icon={<PlusIcon size={14} />} onClick={openNew}>
              {t("b.add")}
            </Button>
          }
        />
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-160 text-start text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-start text-[10px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                <th className="px-4 py-2.5 text-start font-semibold">{t("b.label")}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t("b.category")}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{t("b.planned")}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{t("b.actual")}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{t("b.variance")}</th>
                <th className="px-3 py-2.5" aria-label="actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {budget.map((l) => {
                const variance = l.planned - l.actual;
                const pct = l.planned > 0 ? Math.min(100, Math.round((l.actual / l.planned) * 100)) : null;
                return (
                  <tr key={l.id} className="align-top">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{l.label}</p>
                      {l.notes && <p className="text-[11px] text-[var(--text-dim)]">{l.notes}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{t(`cat.${l.category}`)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{fmt(l.planned)}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">{fmt(l.actual)}</td>
                    <td className={`px-3 py-2.5 text-end tabular-nums ${variance < 0 ? "text-rose-400" : "text-emerald-500"}`}>
                      {variance > 0 ? "+" : ""}
                      {fmt(variance)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {pct != null && (
                          <span className="me-1 hidden h-1 w-16 overflow-hidden rounded-full bg-[var(--bg-secondary)] md:block">
                            <span
                              className={`block h-full rounded-full ${pct > 100 ? "bg-rose-400" : "bg-[var(--text-dim)]"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={t("common.edit")}
                          onClick={() => openEdit(l)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                        >
                          <PencilIcon size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={t("common.delete")}
                          onClick={() => setPendingDelete(l)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-rose-400"
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t("b.edit") : t("b.add")}
        maxWidth="max-w-xl"
        actions={
          <>
            <Button variant="primary" loading={busy} onClick={save}>
              {t("b.save")}
            </Button>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={t("b.label")} value={draft.label} onChange={(v) => setDraft((d) => ({ ...d, label: v }))} placeholder={t("b.labelPh")} wide />
          <SelectField<BudgetCategory>
            label={t("b.category")}
            value={draft.category}
            onChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            options={BUDGET_CATEGORIES.map((c) => ({ value: c, label: t(`cat.${c}`) }))}
          />
          <TextField
            label={t("b.planned")}
            value={draft.planned}
            onChange={(v) => setDraft((d) => ({ ...d, planned: v.replace(/[^\d.]/g, "") }))}
          />
          <TextField
            label={t("b.actual")}
            value={draft.actual}
            onChange={(v) => setDraft((d) => ({ ...d, actual: v.replace(/[^\d.]/g, "") }))}
          />
          <TextAreaField label={t("b.notes")} value={draft.notes} onChange={(v) => setDraft((d) => ({ ...d, notes: v }))} rows={2} />
        </div>
        {error && <p className="text-[12px] text-rose-400">{error}</p>}
      </Modal>

      <ConfirmDialog
        open={!!pendingDelete}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        busy={busy}
        title={t("b.deleteTitle")}
        description={pendingDelete ? t("b.deleteBody").replace("{label}", pendingDelete.label) : undefined}
        confirmLabel={t("common.delete")}
        destructive
      />
    </div>
  );
}
