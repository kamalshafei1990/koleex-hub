"use client";

/* ---------------------------------------------------------------------------
   NotesList — middle pane (the whole screen on phones when no note is
   open). Pinned-first, time-grouped notes with a preview snippet. Search and
   New Note live in the page header above.
   --------------------------------------------------------------------------- */

import { memo, useMemo, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import { notesT } from "@/lib/translations/notes";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PinIcon from "@/components/icons/ui/PinIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import NotesIcon from "@/components/icons/NotesIcon";
import RefreshCcwIcon from "@/components/icons/ui/RefreshCcwIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import {
  formatNoteTimestamp,
  groupNotesByDate,
  type DateBucket,
  type NoteRow,
} from "@/lib/notes";

type T = (k: string) => string;

export default function NotesList({
  notes,
  activeId,
  onSelect,
  onCreate,
  onTogglePin,
  onRename,
  onDelete,
  onRestore,
  onPurge,
  onEmptyTrash,
  hasSearch,
  isTrashView,
  selectionLabel,
  headerExtra,
}: {
  /** null while the first answer for this view is still loading. */
  notes: NoteRow[] | null;
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onTogglePin: (id: string, nextPinned: boolean) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onEmptyTrash: () => void;
  hasSearch: boolean;
  isTrashView: boolean;
  selectionLabel: string;
  /** Extra controls under the pane title (the phone folder picker). */
  headerExtra?: ReactNode;
}) {
  const { t, lang } = useTranslation(notesT);
  const rows = useMemo(() => notes ?? [], [notes]);

  const { pinned, groups } = useMemo(() => {
    if (isTrashView) {
      // Trash view: flat group by date, no pinned split.
      return { pinned: [] as NoteRow[], groups: groupNotesByDate(rows, lang) };
    }
    return {
      pinned: rows.filter((n) => n.is_pinned),
      groups: groupNotesByDate(rows.filter((n) => !n.is_pinned), lang),
    };
  }, [rows, isTrashView, lang]);

  const rowProps = { onSelect, onTogglePin, onRename, onDelete, onRestore, onPurge, t };

  return (
    <div className="flex flex-col h-full">
      {/* Pane header — the selected folder name + count. */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-[var(--text-primary)] truncate leading-tight">
              {selectionLabel}
            </div>
            <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
              {rows.length} {t(rows.length === 1 ? "count.note" : "count.notes")}
            </div>
          </div>
          {isTrashView && rows.length > 0 && (
            <button
              type="button"
              onClick={onEmptyTrash}
              className="h-7 px-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-400 text-[11px] font-semibold hover:bg-red-500/25 transition-all shrink-0"
            >
              {t("emptyTrash")}
            </button>
          )}
        </div>
        {headerExtra}
      </div>

      {/* List body */}
      <div className="flex-1 overflow-y-auto py-1" role="list" aria-label={selectionLabel}>
        {notes === null && (
          <div className="h-full min-h-[240px] flex items-center justify-center gap-2 text-[12px] text-[var(--text-dim)]" role="status">
            <SpinnerIcon className="h-4 w-4" /> {t("list.loading")}
          </div>
        )}

        {notes !== null && rows.length === 0 && (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-faint)]">
              <NotesIcon size={22} />
            </div>
            <div className="text-[13px] text-[var(--text-muted)]">
              {hasSearch ? t("noMatch") : t("nothing")}
            </div>
            {!hasSearch && !isTrashView && (
              <button
                type="button"
                onClick={onCreate}
                className="mt-1 h-8 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-all flex items-center gap-1.5"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                {t("newNote")}
              </button>
            )}
          </div>
        )}

        {pinned.length > 0 && <SectionHeader label={t("pinned")} />}
        {pinned.map((n) => (
          <NoteRowItem key={n.id} note={n} active={n.id === activeId} isTrashView={false} {...rowProps} />
        ))}

        {groups.map((g) => (
          <div key={g.key}>
            <SectionHeader label={bucketLabel(g.bucket, t)} />
            {g.notes.map((n) => (
              <NoteRowItem key={n.id} note={n} active={n.id === activeId} isTrashView={isTrashView} {...rowProps} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function bucketLabel(b: DateBucket, t: T): string {
  switch (b.kind) {
    case "today": return t("section.today");
    case "yesterday": return t("section.yesterday");
    case "week": return t("section.previous7Days");
    case "month": return t("section.previous30Days");
    default: return b.label;
  }
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 pt-3 pb-1.5 text-[10px] uppercase tracking-[1.5px] font-semibold text-[var(--text-dim)]">
      {label}
    </div>
  );
}

const ACTION_BTN =
  "w-7 h-7 md:w-6 md:h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:bg-[var(--bg-surface-subtle)] outline-none focus-visible:ring-2 focus-visible:ring-[#567FB2]";

const NoteRowItem = memo(function NoteRowItem({
  note,
  active,
  onSelect,
  onTogglePin,
  onRename,
  onDelete,
  onRestore,
  onPurge,
  isTrashView,
  t,
}: {
  note: NoteRow;
  active: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, next: boolean) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  isTrashView: boolean;
  /* Passed down rather than re-subscribed: this row renders once per note,
     and useTranslation() in here would open a subscription per row. */
  t: T;
}) {
  const plain = (note.body_plain || "").replace(/\s+/g, " ").trim();
  // List preview — title line if the user typed one, otherwise first
  // line/sentence of the body. Apple Notes uses the same rule.
  const explicit = note.title?.trim();
  const displayTitle = (() => {
    if (explicit) return explicit;
    if (plain) {
      const firstSentence = plain.split(/(?<=[.?!])\s+/)[0];
      const take = firstSentence || plain;
      return take.length > 60 ? take.slice(0, 60) + "…" : take;
    }
    return t("newNote");
  })();
  // Second line — whatever comes after the title in the body, truncated.
  const preview = (() => {
    if (!explicit) {
      const sentences = plain.split(/(?<=[.?!])\s+/);
      if (sentences.length > 1) {
        const rest = sentences.slice(1).join(" ");
        return rest.length > 80 ? rest.slice(0, 80) + "…" : rest;
      }
      return "";
    }
    return plain.length > 80 ? plain.slice(0, 80) + "…" : plain;
  })();
  /* A note someone else shared with me: the owner's organisation (rename,
     pin, trash) is not mine to change. */
  const ownerActions = !note.shared_role;
  const label = displayTitle;

  return (
    <div
      role="listitem"
      className={`group relative w-full border-b border-[var(--border-faint)] transition-all ${
        active
          ? "bg-[#567FB2]/[0.12] border-s-[3px] border-s-[#567FB2] dark:border-s-[#7FA9D6]"
          : "hover:bg-[var(--bg-surface)] focus-within:bg-[var(--bg-surface)]"
      }`}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        {/* The row's main control. `data-kx-keep-hover`: KDS row rule — a
            full-bleed row must not get the Aurora control-hover box. */}
        <button
          type="button"
          data-kx-keep-hover=""
          onClick={() => onSelect(note.id)}
          aria-current={active ? "true" : undefined}
          className="flex-1 min-w-0 text-start outline-none focus-visible:underline"
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            {note.is_pinned && (
              <PinIcon className="h-2.5 w-2.5 text-[#567FB2] dark:text-[#7FA9D6] shrink-0" />
            )}
            {(note.is_shared || note.shared_role) && (
              <span className="shrink-0 text-[#567FB2] dark:text-[#7FA9D6]" title={note.shared_role ? t("list.sharedWithYou") : t("list.shared")}>
                <UsersIcon className="h-3 w-3" />
                <span className="sr-only">{note.shared_role ? t("list.sharedWithYou") : t("list.shared")}</span>
              </span>
            )}
            <span dir="auto" className="text-[13px] font-semibold text-[var(--text-primary)] truncate flex-1">
              {displayTitle}
            </span>
            {note.unread && (
              <span className="shrink-0 h-4 px-1.5 rounded-full bg-[#567FB2] text-white text-[9.5px] font-bold leading-4">
                {t("list.new")}
                <span className="sr-only"> — {t("shared.unreadAria")}</span>
              </span>
            )}
            {note.shared_role && note.owner_name && (
              <span className="text-[10px] text-[var(--text-dim)] shrink-0 truncate max-w-[80px]">{note.owner_name}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
            <span className="shrink-0">{formatNoteTimestamp(note.updated_at, t)}</span>
            <span dir="auto" className="truncate">{preview || t("list.noText")}</span>
          </div>
        </button>

        {/* Row actions — hover, keyboard focus, and always on touch/phones */}
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
          {!isTrashView ? (
            ownerActions && (
              <>
                <button
                  type="button"
                  onClick={() => onRename(note.id)}
                  title={t("rename")}
                  aria-label={`${t("rename")} — ${label}`}
                  className={`${ACTION_BTN} hover:text-[var(--text-primary)]`}
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onTogglePin(note.id, !note.is_pinned)}
                  title={note.is_pinned ? t("unpin") : t("pin")}
                  aria-label={`${note.is_pinned ? t("unpin") : t("pin")} — ${label}`}
                  aria-pressed={note.is_pinned}
                  className={`${ACTION_BTN} hover:text-[#567FB2] dark:hover:text-[#7FA9D6]`}
                >
                  <PinIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(note.id)}
                  title={t("moveToTrash")}
                  aria-label={`${t("moveToTrash")} — ${label}`}
                  className={`${ACTION_BTN} hover:text-red-700 dark:hover:text-red-400`}
                >
                  <TrashIcon className="h-3 w-3" />
                </button>
              </>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => onRestore(note.id)}
                title={t("restore")}
                aria-label={`${t("restore")} — ${label}`}
                className={`${ACTION_BTN} hover:text-emerald-700 dark:hover:text-emerald-400`}
              >
                <RefreshCcwIcon className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onPurge(note.id)}
                title={t("deleteForever")}
                aria-label={`${t("deleteForever")} — ${label}`}
                className={`${ACTION_BTN} hover:text-red-700 dark:hover:text-red-400`}
              >
                <CrossIcon className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
