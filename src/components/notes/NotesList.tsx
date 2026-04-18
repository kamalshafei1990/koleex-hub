"use client";

/* ---------------------------------------------------------------------------
   NotesList — middle pane. Shows pinned-first, time-grouped notes with
   a preview snippet. Has a sticky search bar + "new note" button.
   --------------------------------------------------------------------------- */

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { notesT } from "@/lib/translations/notes";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PinIcon from "@/components/icons/ui/PinIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import {
  formatNoteTimestamp,
  groupNotesByDate,
  type NoteRow,
} from "@/lib/notes";

export default function NotesList({
  notes,
  activeId,
  onSelect,
  onCreate,
  onTogglePin,
  onDelete,
  onRestore,
  onPurge,
  onEmptyTrash,
  search,
  onSearchChange,
  isTrashView,
  selectionLabel,
}: {
  notes: NoteRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onTogglePin: (id: string, nextPinned: boolean) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onEmptyTrash: () => void;
  search: string;
  onSearchChange: (s: string) => void;
  isTrashView: boolean;
  selectionLabel: string;
}) {
  const { t } = useTranslation(notesT);

  const { pinned, groups } = useMemo(() => {
    if (isTrashView) {
      // Trash view: flat group by date, no pinned split.
      return {
        pinned: [] as NoteRow[],
        groups: groupNotesByDate(notes),
      };
    }
    const pinnedNotes = notes.filter((n) => n.is_pinned);
    const others = notes.filter((n) => !n.is_pinned);
    return {
      pinned: pinnedNotes,
      groups: groupNotesByDate(others),
    };
  }, [notes, isTrashView]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="sticky top-14 z-10 bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-[var(--border-subtle)] px-3 py-3">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-[var(--text-primary)] truncate">
              {selectionLabel}
            </div>
            <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </div>
          </div>
          {!isTrashView ? (
            <button
              onClick={onCreate}
              className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-all shrink-0"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {t("newNote")}
            </button>
          ) : (
            notes.length > 0 && (
              <button
                onClick={onEmptyTrash}
                className="h-8 px-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[12px] font-semibold hover:bg-red-500/25 transition-all shrink-0"
              >
                {t("emptyTrash")}
              </button>
            )
          )}
        </div>

        <div className="relative">
          <SearchIcon className="h-3.5 w-3.5 absolute top-1/2 start-2.5 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
          <input
            type="text"
            placeholder={t("search")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8 ps-8 pe-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] transition-colors"
          />
        </div>
      </div>

      {/* List body */}
      <div className="flex-1 py-2">
        {notes.length === 0 && (
          <div className="px-4 py-10 text-center text-[12px] text-[var(--text-dim)]">
            {search.trim() ? t("noMatch") : t("nothing")}
          </div>
        )}

        {pinned.length > 0 && (
          <SectionHeader label={t("pinned")} />
        )}
        {pinned.map((n) => (
          <NoteRowItem
            key={n.id}
            note={n}
            active={n.id === activeId}
            onSelect={onSelect}
            onTogglePin={onTogglePin}
            onDelete={onDelete}
            onRestore={onRestore}
            onPurge={onPurge}
            isTrashView={false}
          />
        ))}

        {groups.map((g) => (
          <div key={g.label}>
            <SectionHeader label={labelize(g.label, t)} />
            {g.notes.map((n) => (
              <NoteRowItem
                key={n.id}
                note={n}
                active={n.id === activeId}
                onSelect={onSelect}
                onTogglePin={onTogglePin}
                onDelete={onDelete}
                onRestore={onRestore}
                onPurge={onPurge}
                isTrashView={isTrashView}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function labelize(label: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    Today: t("section.today"),
    Yesterday: t("section.yesterday"),
    "Previous 7 Days": t("section.previous7Days"),
    "Previous 30 Days": t("section.previous30Days"),
  };
  return map[label] ?? label;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 pt-3 pb-1.5 text-[10px] uppercase tracking-[1.5px] font-semibold text-[var(--text-dim)]">
      {label}
    </div>
  );
}

function NoteRowItem({
  note,
  active,
  onSelect,
  onTogglePin,
  onDelete,
  onRestore,
  onPurge,
  isTrashView,
}: {
  note: NoteRow;
  active: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  isTrashView: boolean;
}) {
  const preview = (note.body_plain || "").slice(0, 80);
  const displayTitle = note.title?.trim() || preview.split(/[.?!]/)[0] || "New Note";
  return (
    <button
      onClick={() => onSelect(note.id)}
      className={`group w-full text-start px-3 py-2.5 border-b border-[var(--border-faint)] transition-all ${
        active
          ? "bg-amber-500/[0.14] border-s-[3px] border-s-amber-400"
          : "hover:bg-[var(--bg-surface)]"
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {note.is_pinned && (
              <PinIcon className="h-2.5 w-2.5 text-amber-400 shrink-0" />
            )}
            <div className="text-[13px] font-semibold text-[var(--text-primary)] truncate flex-1">
              {displayTitle}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
            <span className="shrink-0">{formatNoteTimestamp(note.updated_at)}</span>
            <span className="truncate">{preview || "No additional text"}</span>
          </div>
        </div>

        {/* Row actions */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
          {!isTrashView ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(note.id, !note.is_pinned);
                }}
                title={note.is_pinned ? "Unpin" : "Pin"}
                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-amber-400 hover:bg-[var(--bg-surface-subtle)]"
              >
                <PinIcon className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(note.id);
                }}
                title="Move to Trash"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-[var(--bg-surface-subtle)]"
              >
                <TrashIcon className="h-3 w-3" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore(note.id);
                }}
                title="Restore"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-emerald-400 hover:bg-[var(--bg-surface-subtle)]"
              >
                ↺
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPurge(note.id);
                }}
                title="Delete forever"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-[var(--bg-surface-subtle)]"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
