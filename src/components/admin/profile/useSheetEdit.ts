"use client";

/* ---------------------------------------------------------------------------
   useSheetEdit — the one edit state machine every profile sheet runs on.

   Press Edit on a card → a DRAFT is copied from the row; the sheet reads from
   the draft while that card is open and from the row otherwise. Save is
   enabled once the draft differs from its copy (and is valid); Cancel throws
   the draft away for free. The page is told when a draft is dirty so it can
   guard tab switches and leaving. Esc cancels, ⌘/Ctrl+Enter saves — plain
   Enter is left to the dropdowns and never submits a card by accident.
   --------------------------------------------------------------------------- */

import { useEffect, useState, type KeyboardEvent } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";

export function useSheetEdit<K extends string, D>({
  makeDraft, commit, valid, onDirtyChange, t,
}: {
  /** The draft for a card, copied from the current row. */
  makeDraft: (card: K) => D;
  /** Persist the card's part of the draft. Throw to show an error in the card. */
  commit: (card: K, draft: D) => Promise<void>;
  valid?: (card: K, draft: D) => boolean;
  onDirtyChange: (dirty: boolean) => void;
  t: (k: string, fb?: string) => string;
}) {
  const [editing, setEditing] = useState<K | null>(null);
  const [draft, setDraft] = useState<D | null>(null);
  const [initialJson, setInitialJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = (card: K) => {
    const d = makeDraft(card);
    setDraft(d); setInitialJson(JSON.stringify(d)); setError(null); setEditing(card);
  };
  const cancel = () => { setEditing(null); setDraft(null); setError(null); };
  const dirty = !!draft && JSON.stringify(draft) !== initialJson;
  const ok = !!draft && !!editing && (valid ? valid(editing, draft) : true);
  useEffect(() => { onDirtyChange(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirtyChange(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (u: Partial<D> | ((d: D) => D)) =>
    setDraft((d) => (d ? (typeof u === "function" ? (u as (d: D) => D)(d) : { ...d, ...u }) : d));

  const save = async () => {
    if (!draft || !editing || !dirty || !ok) return;
    setSaving(true); setError(null);
    try {
      await commit(editing, draft);
      setEditing(null); setDraft(null);
    } catch (e) {
      setError(humanizeError(e));
    } finally {
      setSaving(false);
    }
  };
  /** The Group header props for one card. */
  const gp = (card: K, canEdit: boolean) => ({
    editLabel: t("action.edit", "Edit"),
    onEdit: canEdit ? () => begin(card) : undefined,
    editing: editing === card,
    saving,
    error: editing === card ? error : null,
    onSave: save,
    onCancel: cancel,
    saveLabel: t("action.save", "Save"),
    cancelLabel: t("action.cancel", "Cancel"),
    canSave: dirty && ok,
  });
  const onKeyDown = (e: KeyboardEvent) => {
    if (!editing) return;
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); }
  };
  return { editing, draft, dirty, saving, error, begin, cancel, patch, save, gp, onKeyDown, setError };
}
