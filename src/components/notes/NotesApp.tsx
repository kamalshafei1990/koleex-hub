"use client";

/* ---------------------------------------------------------------------------
   NotesApp — the top-level Notes module. Orchestrates folders, notes list,
   and editor in a three-pane layout inspired by Apple Notes. Mobile
   collapses the panes into a drill-down stack.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import NotesIcon from "@/components/icons/NotesIcon";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import Button from "@/components/ui/Button";
import { useSearchPlaceholder } from "@/lib/searchPlaceholders";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
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
import { PromptDialog, ConfirmDialog } from "./NotesDialog";

export default function NotesApp() {
  const { t } = useTranslation(notesT);
  const searchPlaceholder = useSearchPlaceholder("notes");

  const [folders, setFolders] = useState<NotesFolderRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [selection, setSelection] = useState<FolderSelection>({
    kind: "smart",
    key: "all",
  });
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<NoteFull | null>(null);
  // Issue 75570338 (Mustafa) — cycle 3. The previous cycle added a Focus
  // Mode toggle but defaulted it OFF, so the editor was still sharing
  // screen with two side panes on open. A toggle is no help if you don't
  // know it exists. Default is now ON: the editor takes the full window
  // width the moment you open Notes. The toggle stays for users who want
  // the 3-pane layout back; their choice persists in localStorage.
  // Storage rule: only an explicit "0" means OFF; anything else (incl.
  // never-saved) keeps the new default ON.
  const [focusMode, setFocusMode] = useState<boolean>(true);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("notes:focusMode");
      if (v === "0") setFocusMode(false);
      else setFocusMode(true);
    } catch { /* sandboxed storage — no-op */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem("notes:focusMode", focusMode ? "1" : "0"); } catch { /* */ }
  }, [focusMode]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");

  /* Dialogs — replacements for the native window.prompt / confirm. */
  const [folderPrompt, setFolderPrompt] = useState<
    | { open: true; parentId: string | null; initial: string; mode: "create" | "rename"; folderId?: string }
    | { open: false }
  >({ open: false });
  const [deletePrompt, setDeletePrompt] = useState<
    | { open: true; kind: "trash" | "purge" | "folder" | "emptyTrash"; id?: string; label?: string }
    | { open: false }
  >({ open: false });
  const [notePrompt, setNotePrompt] = useState<
    | { open: true; id: string; initial: string }
    | { open: false }
  >({ open: false });

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

  /* These open the PromptDialog rather than doing the work directly.
     The confirm callback in the dialog calls the low-level helpers. */
  const onAskCreateFolder = useCallback(
    (parentId: string | null = null) => {
      setFolderPrompt({
        open: true,
        mode: "create",
        parentId,
        initial: "",
      });
    },
    [],
  );

  const onAskRenameFolder = useCallback((folder: NotesFolderRow) => {
    setFolderPrompt({
      open: true,
      mode: "rename",
      parentId: folder.parent_id,
      folderId: folder.id,
      initial: folder.name,
    });
  }, []);

  const submitFolderPrompt = useCallback(
    async (name: string) => {
      if (!folderPrompt.open || !name.trim()) return;
      if (folderPrompt.mode === "create") {
        const f = await createFolder({
          name: name.trim(),
          parent_id: folderPrompt.parentId,
        });
        if (f) {
          setFolders((prev) => [...prev, f]);
          setSelection({ kind: "folder", id: f.id });
        }
      } else if (folderPrompt.mode === "rename" && folderPrompt.folderId) {
        const ok = await updateFolder(folderPrompt.folderId, { name: name.trim() });
        if (ok) {
          setFolders((prev) =>
            prev.map((f) =>
              f.id === folderPrompt.folderId ? { ...f, name: name.trim() } : f,
            ),
          );
        }
      }
    },
    [folderPrompt],
  );

  const onAskDeleteFolder = useCallback(
    (id: string) => {
      const label = folders.find((f) => f.id === id)?.name ?? "";
      setDeletePrompt({ open: true, kind: "folder", id, label });
    },
    [folders],
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
    (id: string) => {
      const target = notes.find((n) => n.id === id);
      const label = target?.title?.trim() || t("untitled");
      setDeletePrompt({ open: true, kind: "trash", id, label });
    },
    [notes, t],
  );

  const onAskRenameNote = useCallback(
    (id: string) => {
      const target = notes.find((n) => n.id === id);
      if (!target) return;
      setNotePrompt({
        open: true,
        id,
        initial: target.title ?? "",
      });
    },
    [notes],
  );

  const submitRenameNote = useCallback(
    async (name: string) => {
      if (!notePrompt.open) return;
      const id = notePrompt.id;
      const next = name.trim();
      const ok = await updateNote(id, { title: next });
      if (ok) {
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, title: next } : n)),
        );
        if (activeNote?.id === id) {
          setActiveNote({ ...activeNote, title: next });
        }
      }
    },
    [notePrompt, activeNote],
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
    (id: string) => {
      const target = notes.find((n) => n.id === id);
      const label = target?.title?.trim() || t("untitled");
      setDeletePrompt({ open: true, kind: "purge", id, label });
    },
    [notes, t],
  );

  const onEmptyTrash = useCallback(() => {
    setDeletePrompt({ open: true, kind: "emptyTrash" });
  }, []);

  const onMoveNote = useCallback(
    async (id: string, folderId: string | null) => {
      const ok = await updateNote(id, { folder_id: folderId });
      if (ok) await reloadNotes();
    },
    [reloadNotes],
  );

  /* Runs when the user clicks "Confirm" in the delete dialog. Dispatches
     on the stored kind — trash / purge / empty-trash / folder. */
  const handleConfirmDelete = useCallback(async () => {
    if (!deletePrompt.open) return;
    if (deletePrompt.kind === "trash" && deletePrompt.id) {
      const ok = await deleteNote(deletePrompt.id);
      if (ok) {
        setNotes((prev) => prev.filter((n) => n.id !== deletePrompt.id));
        if (activeNoteId === deletePrompt.id) setActiveNoteId(null);
      }
    } else if (deletePrompt.kind === "purge" && deletePrompt.id) {
      const ok = await purgeNote(deletePrompt.id);
      if (ok) {
        setNotes((prev) => prev.filter((n) => n.id !== deletePrompt.id));
        if (activeNoteId === deletePrompt.id) setActiveNoteId(null);
      }
    } else if (deletePrompt.kind === "emptyTrash") {
      const ok = await emptyTrash();
      if (ok) {
        setNotes([]);
        setActiveNoteId(null);
      }
    } else if (deletePrompt.kind === "folder" && deletePrompt.id) {
      const ok = await deleteFolder(deletePrompt.id);
      if (ok) {
        setFolders((prev) => prev.filter((f) => f.id !== deletePrompt.id));
        if (selection.kind === "folder" && selection.id === deletePrompt.id) {
          setSelection({ kind: "smart", key: "all" });
        }
      }
    }
  }, [deletePrompt, activeNoteId, selection]);

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

      // Title rules (match Apple Notes):
      //  1. If the user explicitly typed in the title input, save that
      //     verbatim — even if it's empty (clearing is allowed).
      //  2. Otherwise, if the body changed AND the current saved title
      //     is empty, derive a title from the first line of the body.
      //     Never overwrite a title the user already set.
      const currentTitle =
        activeNote?.id === id ? (activeNote.title ?? "") : "";
      let title: string | undefined = undefined;
      if (updates.title !== undefined) {
        title = updates.title;
      } else if (
        updates.body_json !== undefined &&
        !currentTitle.trim()
      ) {
        title = deriveAutoTitle(updates.body_json);
      }

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

  const selectionLabel =
    selection.kind === "folder"
      ? folders.find((f) => f.id === selection.id)?.name ?? "—"
      : selection.key === "all"
        ? t("smart.allNotes")
        : selection.key === "pinned"
          ? t("smart.pinned")
          : selection.key === "none"
            ? t("smart.none")
            : t("smart.trash");

  const totalNotes = notes.length;

  // RootShell already renders MainHeader (top) and Sidebar (left). Our
  // page fills the remaining viewport. Use 100dvh-3.5rem so the three
  // panes stretch to the bottom without producing a double-scrollbar,
  // matching the To-do and Calendar apps.
  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* ── PAGE HEADER — canonical Hub PageHeader ── */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] w-full">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 min-w-0 pt-5 pb-3">
          <PageHeader
            title={t("app.title")}
            subtitle={`${t("app.subtitle")} · ${totalNotes} ${totalNotes === 1 ? "note" : "notes"}`}
            icon={<NotesIcon size={16} />}
            showTabs={false}
          />

          {/* Brand-aligned tile menu + search — same across every Hub app */}
          <div className="mt-5 mb-3">
            <AppHomeMenu
              navItems={[
                { key: "all",     onClick: () => setSelection({ kind: "smart", key: "all" }),    icon: "document",   label: "All Notes" },
                { key: "pinned",  onClick: () => setSelection({ kind: "smart", key: "pinned" }), icon: "star",       label: "Pinned"    },
                { key: "none",    onClick: () => setSelection({ kind: "smart", key: "none" }),   icon: "file",       label: "Unfiled"   },
                { key: "trash",   onClick: () => setSelection({ kind: "smart", key: "trash" }),  icon: "recycle",    label: "Trash"     },
                { key: "new",     onClick: onCreateNote,                                          icon: "plus",       label: "New Note"  },
              ]}
              searchPlaceholder={searchPlaceholder}
              onSearchSubmit={(term) => setSearch(term)}
            />
          </div>

          {/* Search + quick New Note */}
          <div className="flex items-center gap-2 pb-3 min-w-0">
            <div className="flex-1 min-w-0 flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 md:px-4 gap-2 md:gap-3 focus-within:border-[var(--border-focus)] transition-all">
              <SearchIcon className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
                className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none h-10"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="p-0.5 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                >
                  <CrossIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button onClick={onCreateNote} icon={<PlusIcon className="h-3.5 w-3.5" />}>
              <span className="hidden md:inline">{t("newNote")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Focus mode toggle — a small strip above the body so it's always
          reachable. When ON, hides folders + notes-list and gives the editor
          the full window width (issue 75570338 reopened by Mustafa). */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/95">
        <div className="max-w-[1600px] mx-auto flex items-center justify-end gap-2 px-4 md:px-6 lg:px-8 py-2">
          <button
            type="button"
            onClick={() => setFocusMode((v) => !v)}
            title={focusMode ? "Show folders + notes list" : "Hide folders + notes list (give the editor the whole window)"}
            aria-pressed={focusMode}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
              focusMode
                ? "border-[var(--bg-inverted)] bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 9V5a2 2 0 0 1 2-2h4M21 9V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4M21 15v4a2 2 0 0 1-2 2h-4" />
            </svg>
            {focusMode ? "Exit focus" : "Focus mode"}
          </button>
        </div>
      </div>

      {/* ── BODY ── 3 panes by default, single pane in focus mode. */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`h-full grid grid-cols-1 ${focusMode ? "md:grid-cols-1" : "md:grid-cols-[200px_260px_1fr]"}`}>
          {/* Pane 1 — Folders (hidden in focus mode) */}
          <div className={`${focusMode ? "hidden" : "hidden md:block"} border-e border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 overflow-y-auto`}>
            <FoldersSidebar
              folders={folders}
              selection={selection}
              onSelect={setSelection}
              onAskCreateFolder={onAskCreateFolder}
              onAskRenameFolder={onAskRenameFolder}
              onAskDeleteFolder={onAskDeleteFolder}
              notesCountByFolder={notesCountByFolder}
            />
          </div>

          {/* Pane 2 — Notes list (hidden in focus mode) */}
          <div className={`${focusMode ? "hidden" : "hidden md:block"} border-e border-[var(--border-subtle)] overflow-hidden`}>
            <NotesList
              notes={notes}
              activeId={activeNoteId}
              onSelect={setActiveNoteId}
              onCreate={onCreateNote}
              onTogglePin={onTogglePin}
              onRename={onAskRenameNote}
              onDelete={onDeleteNote}
              onRestore={onRestoreNote}
              onPurge={onPurgeNote}
              onEmptyTrash={onEmptyTrash}
              search={search}
              onSearchChange={setSearch}
              isTrashView={isTrashView}
              selectionLabel={selectionLabel}
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
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────── */}
      <PromptDialog
        open={folderPrompt.open}
        title={folderPrompt.open && folderPrompt.mode === "rename" ? t("rename") : t("newFolder")}
        label={t("folderName")}
        placeholder={t("folderName")}
        initialValue={folderPrompt.open ? folderPrompt.initial : ""}
        onConfirm={submitFolderPrompt}
        onClose={() => setFolderPrompt({ open: false })}
      />

      <PromptDialog
        open={notePrompt.open}
        title={t("rename")}
        label={t("noteName")}
        placeholder={t("untitled")}
        initialValue={notePrompt.open ? notePrompt.initial : ""}
        onConfirm={submitRenameNote}
        onClose={() => setNotePrompt({ open: false })}
      />

      <ConfirmDialog
        open={deletePrompt.open}
        variant="danger"
        title={
          !deletePrompt.open
            ? ""
            : deletePrompt.kind === "trash"
              ? `${t("moveToTrash")} — "${deletePrompt.label ?? ""}"?`
              : deletePrompt.kind === "purge"
                ? `${t("deleteForever")} — "${deletePrompt.label ?? ""}"?`
                : deletePrompt.kind === "emptyTrash"
                  ? t("emptyTrash")
                  : t("deleteFolder")
        }
        description={
          !deletePrompt.open
            ? ""
            : deletePrompt.kind === "purge"
              ? "This note will be permanently removed. This cannot be undone."
              : deletePrompt.kind === "emptyTrash"
                ? t("emptyTrashConfirm")
                : deletePrompt.kind === "folder"
                  ? t("deleteFolderConfirm")
                  : "The note will be moved to Recently Deleted and can be restored within 30 days."
        }
        confirmLabel={
          !deletePrompt.open
            ? "OK"
            : deletePrompt.kind === "trash"
              ? t("moveToTrash")
              : deletePrompt.kind === "purge"
                ? t("deleteForever")
                : deletePrompt.kind === "emptyTrash"
                  ? t("emptyTrash")
                  : t("delete")
        }
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletePrompt({ open: false })}
      />
    </div>
  );
}
