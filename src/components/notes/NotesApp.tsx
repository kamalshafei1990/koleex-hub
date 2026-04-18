"use client";

/* ---------------------------------------------------------------------------
   NotesApp — the top-level Notes module. Orchestrates folders, notes list,
   and editor in a three-pane layout inspired by Apple Notes. Mobile
   collapses the panes into a drill-down stack.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import MainHeader from "@/components/layout/MainHeader";
import Sidebar from "@/components/layout/Sidebar";
import { useTranslation } from "@/lib/i18n";
import { notesT } from "@/lib/translations/notes";
import {
  fetchFolders,
  fetchNotes,
  fetchNote,
  createNote,
  updateNote,
  deleteNote,
  restoreNote,
  purgeNote,
  emptyTrash,
  createFolder,
  updateFolder,
  deleteFolder,
  extractPlainText,
  deriveAutoTitle,
  type NotesFolderRow,
  type NoteRow,
  type NoteFull,
} from "@/lib/notes";

import FoldersSidebar, { type FolderSelection } from "./FoldersSidebar";
import NotesList from "./NotesList";
import NoteEditor from "./NoteEditor";

export default function NotesApp() {
  const { t } = useTranslation(notesT);

  const [folders, setFolders] = useState<NotesFolderRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [selection, setSelection] = useState<FolderSelection>({
    kind: "smart",
    key: "all",
  });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<NoteFull | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");

  // Hydrate folders + notes on mount.
  useEffect(() => {
    void fetchFolders().then(setFolders);
  }, []);

  /* Reload the list whenever selection or search changes. Does NOT
     touch activeNoteId — selection is driven by explicit clicks or the
     create/delete flow below, not by reload side-effects (which caused
     a race where the editor showed "Select a note" right after create). */
  const reloadNotes = useCallback(async () => {
    const params: Parameters<typeof fetchNotes>[0] = {};
    if (selection.kind === "folder") params.folderId = selection.id;
    else params.smartFolder = selection.key;
    if (search.trim()) params.search = search.trim();
    const rows = await fetchNotes(params);
    setNotes(rows);
    return rows;
  }, [selection, search]);

  useEffect(() => {
    void reloadNotes();
  }, [reloadNotes]);

  /* When the selection changes, clear the editor. The user has to
     either pick a note or hit New Note to see the editor again. */
  useEffect(() => {
    setActiveNoteId(null);
    setActiveNote(null);
  }, [selection]);

  /* If the currently selected note disappears from the list (e.g.
     moved to a different folder, deleted, filtered out by search),
     clear the editor so we don't show stale content. */
  useEffect(() => {
    if (activeNoteId && !notes.some((n) => n.id === activeNoteId)) {
      setActiveNoteId(null);
      setActiveNote(null);
    }
  }, [notes, activeNoteId]);

  /* Fetch the full note (with body_json) whenever activeNoteId changes.
     Keeps the previous activeNote visible during the fetch so the
     editor doesn't flash back to the empty state. */
  useEffect(() => {
    if (!activeNoteId) return;
    let cancelled = false;
    void fetchNote(activeNoteId).then((n) => {
      if (!cancelled && n) setActiveNote(n);
    });
    return () => {
      cancelled = true;
    };
  }, [activeNoteId]);

  // ── Folder actions ─────────────────────────────────────────────────────

  const onCreateFolder = useCallback(
    async (name: string, parentId: string | null = null) => {
      const f = await createFolder({ name, parent_id: parentId });
      if (f) {
        setFolders((prev) => [...prev, f]);
        setSelection({ kind: "folder", id: f.id });
      }
    },
    [],
  );

  const onRenameFolder = useCallback(async (id: string, name: string) => {
    const ok = await updateFolder(id, { name });
    if (ok) {
      setFolders((prev) =>
        prev.map((f) => (f.id === id ? { ...f, name } : f)),
      );
    }
  }, []);

  const onDeleteFolder = useCallback(
    async (id: string) => {
      if (!window.confirm(t("deleteFolderConfirm"))) return;
      const ok = await deleteFolder(id);
      if (ok) {
        setFolders((prev) => prev.filter((f) => f.id !== id));
        if (selection.kind === "folder" && selection.id === id) {
          setSelection({ kind: "smart", key: "all" });
        }
      }
    },
    [selection, t],
  );

  // ── Note actions ───────────────────────────────────────────────────────

  const onCreateNote = useCallback(async () => {
    const folderId = selection.kind === "folder" ? selection.id : null;
    const n = await createNote({
      title: "",
      folder_id: folderId,
      body_json: { type: "doc", content: [{ type: "paragraph" }] },
      body_plain: "",
    });
    if (!n) return;

    // Make the new note visible + selected IMMEDIATELY so the editor
    // opens without a round-trip through the server. reloadNotes runs
    // after — it just refreshes metadata.
    setNotes((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
    setActiveNote(n);
    setActiveNoteId(n.id);
    void reloadNotes();
  }, [selection, reloadNotes]);

  const onTogglePin = useCallback(
    async (id: string, nextPinned: boolean) => {
      const ok = await updateNote(id, { is_pinned: nextPinned });
      if (ok) {
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_pinned: nextPinned } : n)),
        );
      }
    },
    [],
  );

  const onDeleteNote = useCallback(
    async (id: string) => {
      const ok = await deleteNote(id);
      if (ok) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        if (activeNoteId === id) setActiveNoteId(null);
      }
    },
    [activeNoteId],
  );

  const onRestoreNote = useCallback(
    async (id: string) => {
      const ok = await restoreNote(id);
      if (ok) {
        await reloadNotes();
      }
    },
    [reloadNotes],
  );

  const onPurgeNote = useCallback(
    async (id: string) => {
      const ok = await purgeNote(id);
      if (ok) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        if (activeNoteId === id) setActiveNoteId(null);
      }
    },
    [activeNoteId],
  );

  const onEmptyTrash = useCallback(async () => {
    if (
      !window.confirm(t("emptyTrashConfirm"))
    )
      return;
    const ok = await emptyTrash();
    if (ok) {
      setNotes([]);
      setActiveNoteId(null);
    }
  }, [t]);

  const onMoveNote = useCallback(
    async (id: string, folderId: string | null) => {
      const ok = await updateNote(id, { folder_id: folderId });
      if (ok) await reloadNotes();
    },
    [reloadNotes],
  );

  // ── Editor auto-save ────────────────────────────────────────────────────

  const onNoteChange = useCallback(
    async (
      id: string,
      updates: { title?: string; body_json?: unknown },
    ) => {
      setSaving("saving");
      const body_plain =
        updates.body_json !== undefined
          ? extractPlainText(updates.body_json)
          : undefined;
      const title =
        updates.title !== undefined
          ? updates.title
          : updates.body_json !== undefined
            ? deriveAutoTitle(updates.body_json)
            : undefined;
      const patch: Record<string, unknown> = {};
      if (title !== undefined) patch.title = title;
      if (updates.body_json !== undefined) patch.body_json = updates.body_json;
      if (body_plain !== undefined) patch.body_plain = body_plain;
      const ok = await updateNote(id, patch);
      setSaving(ok ? "saved" : "idle");

      // Reflect the change in the list without a full reload. Bump
      // updated_at so the time-grouping sort stays correct.
      setNotes((prev) => {
        const nowIso = new Date().toISOString();
        const mapped = prev.map((n) =>
          n.id === id
            ? {
                ...n,
                title: title ?? n.title,
                body_plain: body_plain ?? n.body_plain,
                updated_at: nowIso,
              }
            : n,
        );
        // Re-sort: pinned first, then updated_at desc.
        mapped.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return (
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime()
          );
        });
        return mapped;
      });

      if (activeNote && activeNote.id === id) {
        setActiveNote({ ...activeNote, ...patch } as NoteFull);
      }

      if (ok) {
        setTimeout(() => setSaving((s) => (s === "saved" ? "idle" : s)), 1200);
      }
    },
    [activeNote],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  const isTrashView =
    selection.kind === "smart" && selection.key === "trash";

  const notesCountByFolder = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) {
      if (!n.folder_id || n.deleted_at) continue;
      m.set(n.folder_id, (m.get(n.folder_id) ?? 0) + 1);
    }
    return m;
  }, [notes]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <MainHeader />
      <Sidebar />

      <main className="pt-14 md:ps-[68px] h-screen overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[260px_320px_1fr] h-[calc(100vh-56px)]">
          {/* Pane 1 — Folders */}
          <div className="hidden md:block border-e border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 overflow-y-auto">
            <FoldersSidebar
              folders={folders}
              selection={selection}
              onSelect={setSelection}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              notesCountByFolder={notesCountByFolder}
            />
          </div>

          {/* Pane 2 — Notes list */}
          <div className="hidden md:block border-e border-[var(--border-subtle)] overflow-hidden">
            <NotesList
              notes={notes}
              activeId={activeNoteId}
              onSelect={setActiveNoteId}
              onCreate={onCreateNote}
              onTogglePin={onTogglePin}
              onDelete={onDeleteNote}
              onRestore={onRestoreNote}
              onPurge={onPurgeNote}
              onEmptyTrash={onEmptyTrash}
              search={search}
              onSearchChange={setSearch}
              isTrashView={isTrashView}
              selectionLabel={
                selection.kind === "folder"
                  ? folders.find((f) => f.id === selection.id)?.name ?? "—"
                  : selection.key === "all"
                    ? t("smart.allNotes")
                    : selection.key === "pinned"
                      ? t("smart.pinned")
                      : selection.key === "none"
                        ? t("smart.none")
                        : t("smart.trash")
              }
            />
          </div>

          {/* Pane 3 — Editor */}
          <div className="overflow-hidden">
            <NoteEditor
              note={activeNote}
              folders={folders}
              readOnly={isTrashView}
              saving={saving}
              onChange={(updates) => {
                if (!activeNote) return;
                void onNoteChange(activeNote.id, updates);
              }}
              onMove={(folderId) => {
                if (!activeNote) return;
                void onMoveNote(activeNote.id, folderId);
              }}
              onTogglePin={() => {
                if (!activeNote) return;
                void onTogglePin(activeNote.id, !activeNote.is_pinned);
                setActiveNote({ ...activeNote, is_pinned: !activeNote.is_pinned });
              }}
              onDelete={() => {
                if (!activeNote) return;
                void onDeleteNote(activeNote.id);
              }}
              onRestore={() => {
                if (!activeNote) return;
                void onRestoreNote(activeNote.id);
              }}
              onPurge={() => {
                if (!activeNote) return;
                void onPurgeNote(activeNote.id);
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
