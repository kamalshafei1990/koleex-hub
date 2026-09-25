"use client";

/* ---------------------------------------------------------------------------
   NotesApp — the top-level Notes module. Orchestrates folders, notes list
   and editor.

   Layout:
     · md+  — three panes (folders · list · editor). With a note open, the
              Focus toggle hides the first two and gives the editor the whole
              width (preference persisted per browser).
     · <md  — drill-down: the list when no note is open, the editor (with a
              Back button) when one is.

   Data:
     · Folders (+ server-side per-folder counts) and the default "All Notes"
       list paint from the warm cache, then revalidate.
     · Search is debounced; a newer request aborts the older one and stale
       answers are dropped by sequence number.
     · Saves are serialized per note with optimistic concurrency
       (base_updated_at → 409 → reload + toast).

   Deep links: /notes?id=<noteId> opens a note, /notes?new=1 creates one.
   Shortcuts: Ctrl/Cmd+N new note (not while typing), Ctrl/Cmd+K search,
   Esc closes the open dialog / clears search / closes the note.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import NotesIcon from "@/components/icons/NotesIcon";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
import { useToast } from "@/components/kds/useToast";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PinIcon from "@/components/icons/ui/PinIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import Maximize2Icon from "@/components/icons/ui/Maximize2Icon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { useTranslation } from "@/lib/i18n";
import { useSearchPlaceholder } from "@/lib/searchPlaceholders";
import { notesT } from "@/lib/translations/notes";
import { useWarm, writeWarm } from "@/lib/warm-cache";
import { useOpenOnNewParam } from "@/lib/use-open-on-new-param";
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
  type FoldersPayload,
  type NotesFolderRow,
  type NoteRow,
  type NoteFull,
  type NotePatch,
} from "@/lib/notes";
import { NOTE_LIMITS, UUID_RE } from "@/lib/notes-policy";

import { useMeBootstrap } from "@/lib/me-bootstrap";
import FoldersSidebar, { type FolderSelection } from "./FoldersSidebar";
import NotesList from "./NotesList";
import ShareDialog from "./ShareDialog";
import { PromptDialog } from "./NotesDialog";
import type { EditorChange, SaveResult, SaveState } from "./NoteEditor";

/* TipTap is the heavy part of this screen — load it on its own so the list
   paints first. */
const NoteEditor = dynamic(() => import("./NoteEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[40vh] flex items-center justify-center text-[var(--text-dim)]">
      <SpinnerIcon className="h-4 w-4" />
    </div>
  ),
});

const FOCUS_KEY = "notes:focusMode.v2";
const WARM_FOLDERS = "notes:folders";
const WARM_ALL = "notes:list:all";

function queryKeyOf(sel: FolderSelection, search: string): string {
  return `${sel.kind === "folder" ? `f:${sel.id}` : `s:${sel.key}`}|${search}`;
}

function sortNotes(rows: NoteRow[]): NoteRow[] {
  return [...rows].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Record a newer updated_at for `id` (never move the token backwards). */
function bumpBase(map: Map<string, string>, id: string, updatedAt: string | null | undefined) {
  if (!updatedAt) return;
  const cur = map.get(id);
  if (!cur || new Date(updatedAt).getTime() >= new Date(cur).getTime()) map.set(id, updatedAt);
}

type DeletePrompt =
  | { open: true; kind: "trash" | "purge" | "folder" | "emptyTrash"; id?: string; label?: string }
  | { open: false };

export default function NotesApp() {
  const { t } = useTranslation(notesT);
  const searchPlaceholder = useSearchPlaceholder("notes");
  const { data: meBootstrap } = useMeBootstrap();
  const { showToast, toastElement } = useToast();
  /* Language loads after mount, so `t` changes identity once; data loaders
     read it through a ref so that does not refetch anything. */
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  const toastError = useCallback(() => showToast(tRef.current("error.generic"), "error"), [showToast]);

  /** Collaboration identity (account id + display name) for realtime. */
  const collabMe = useMemo(() => {
    const a = meBootstrap?.auth as { account_id?: string; username?: string } | undefined;
    if (!a?.account_id) return null;
    return { id: a.account_id, name: a.username || t("you") };
  }, [meBootstrap, t]);

  const [shareOpen, setShareOpen] = useState(false);

  /* ── Folders (warm) ─────────────────────────────────────────────────── */
  const warmFolders = useWarm<FoldersPayload>(WARM_FOLDERS);
  const [foldersState, setFoldersState] = useState<FoldersPayload | null>(null);
  const foldersPayload = foldersState ?? warmFolders;
  const folders = useMemo(() => foldersPayload?.folders ?? [], [foldersPayload]);
  const folderCounts = useMemo(() => foldersPayload?.counts ?? {}, [foldersPayload]);

  const refreshFolders = useCallback(async () => {
    try {
      const p = await fetchFolders();
      writeWarm(WARM_FOLDERS, p);
      setFoldersState(p);
    } catch { /* keep what we have */ }
  }, []);
  useEffect(() => { void refreshFolders(); }, [refreshFolders]);

  const patchFolders = useCallback(
    (fn: (f: NotesFolderRow[]) => NotesFolderRow[]) => {
      setFoldersState((prev) => {
        const base = prev ?? warmFolders ?? { folders: [], counts: {} };
        return { ...base, folders: fn(base.folders) };
      });
    },
    [warmFolders],
  );

  /* ── Selection + search ─────────────────────────────────────────────── */
  const [selection, setSelection] = useState<FolderSelection>({ kind: "smart", key: "all" });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim().slice(0, NOTE_LIMITS.search)), 250);
    return () => clearTimeout(id);
  }, [search]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  /* ── Notes list (warm for the default view only) ────────────────────── */
  const queryKey = queryKeyOf(selection, debouncedSearch);
  const listWarmKey = selection.kind === "smart" && selection.key === "all" && !debouncedSearch ? WARM_ALL : "";
  const warmList = useWarm<NoteRow[]>(listWarmKey);
  const [listState, setListState] = useState<{ q: string; rows: NoteRow[] } | null>(null);
  const notes: NoteRow[] | null =
    listState && listState.q === queryKey ? listState.rows : warmList ?? null;

  const queryKeyRef = useRef(queryKey);
  const warmListRef = useRef(warmList);
  const notesRef = useRef(notes);
  useEffect(() => {
    queryKeyRef.current = queryKey;
    warmListRef.current = warmList;
    notesRef.current = notes;
  });

  /** Functional update of the rows on screen (no-op while nothing is shown). */
  const setNotes = useCallback((fn: (rows: NoteRow[]) => NoteRow[]) => {
    setListState((prev) => {
      const q = queryKeyRef.current;
      const base = prev && prev.q === q ? prev.rows : warmListRef.current ?? null;
      if (!base) return prev;
      return { q, rows: fn(base) };
    });
  }, []);

  const reqSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const reloadNotes = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const seq = ++reqSeq.current;
    const params: Parameters<typeof fetchNotes>[0] = {};
    if (selection.kind === "folder") params.folderId = selection.id;
    else params.smartFolder = selection.key;
    if (debouncedSearch) params.search = debouncedSearch;
    try {
      const rows = await fetchNotes(params, ctrl.signal);
      if (seq !== reqSeq.current) return; // a newer request owns the screen
      setListState({ q: queryKey, rows });
      if (listWarmKey) writeWarm(listWarmKey, rows);
    } catch {
      if (ctrl.signal.aborted || seq !== reqSeq.current) return;
      setListState((prev) => (prev && prev.q === queryKey ? prev : { q: queryKey, rows: warmListRef.current ?? [] }));
      toastError();
    }
  }, [selection, debouncedSearch, queryKey, listWarmKey, toastError]);

  useEffect(() => {
    void reloadNotes();
  }, [reloadNotes]);
  useEffect(() => () => abortRef.current?.abort(), []);

  /* ── Active note ────────────────────────────────────────────────────── */
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<NoteFull | null>(null);
  const [contentVersion, setContentVersion] = useState(0);
  const [titleSignal, setTitleSignal] = useState<{ id: string; title: string; seq: number } | null>(null);
  const activeNoteIdRef = useRef(activeNoteId);
  const activeNoteRef = useRef(activeNote);
  useEffect(() => {
    activeNoteIdRef.current = activeNoteId;
    activeNoteRef.current = activeNote;
  });

  /** Last updated_at this client saw per note — the concurrency token. */
  const baseRef = useRef<Map<string, string>>(new Map());
  const skipFetchRef = useRef<string | null>(null);

  const closeNote = useCallback(() => {
    setActiveNoteId(null);
    setActiveNote(null);
  }, []);

  /* Fetch the full note (with body_json) whenever activeNoteId changes.
     Keeps the previous note visible during the fetch so the editor doesn't
     flash back to the empty state. */
  useEffect(() => {
    if (!activeNoteId) return;
    if (skipFetchRef.current === activeNoteId) { skipFetchRef.current = null; return; }
    let cancelled = false;
    void fetchNote(activeNoteId).then((n) => {
      if (cancelled) return;
      if (!n) {
        toastError();
        setActiveNoteId((cur) => (cur === activeNoteId ? null : cur));
        setActiveNote((cur) => (cur?.id === activeNoteId ? null : cur));
        return;
      }
      bumpBase(baseRef.current, n.id, n.updated_at);
      setActiveNote(n);
    });
    return () => { cancelled = true; };
  }, [activeNoteId, toastError]);

  /* Selecting a folder/view from the UI closes the open note. */
  const selectView = useCallback((sel: FolderSelection) => {
    setSelection(sel);
    closeNote();
  }, [closeNote]);

  /* ── Focus mode (md+, only while a note is open) ────────────────────── */
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(FOCUS_KEY) === "1") setFocusMode(true);
    } catch { /* sandboxed storage — no-op */ }
  }, []);
  const toggleFocus = useCallback(() => {
    setFocusMode((v) => {
      const next = !v;
      try { window.localStorage.setItem(FOCUS_KEY, next ? "1" : "0"); } catch { /* */ }
      return next;
    });
  }, []);
  const focused = focusMode && !!activeNoteId;

  /* ── Save state ─────────────────────────────────────────────────────── */
  const [saving, setSaving] = useState<SaveState>("idle");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  /* ── Dialogs ────────────────────────────────────────────────────────── */
  const [folderPrompt, setFolderPrompt] = useState<
    | { open: true; parentId: string | null; initial: string; mode: "create" | "rename"; folderId?: string }
    | { open: false }
  >({ open: false });
  const [deletePrompt, setDeletePrompt] = useState<DeletePrompt>({ open: false });
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notePrompt, setNotePrompt] = useState<
    | { open: true; id: string; initial: string }
    | { open: false }
  >({ open: false });

  // ── Folder actions ─────────────────────────────────────────────────────

  const onAskCreateFolder = useCallback((parentId: string | null = null) => {
    setFolderPrompt({ open: true, mode: "create", parentId, initial: "" });
  }, []);

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
    async (name: string): Promise<boolean> => {
      if (!folderPrompt.open) return true;
      const clean = name.trim();
      if (!clean) return false;
      if (folderPrompt.mode === "create") {
        const f = await createFolder({ name: clean, parent_id: folderPrompt.parentId });
        if (!f) { showToast(t("error.generic"), "error"); return false; }
        patchFolders((prev) => [...prev, f]);
        selectView({ kind: "folder", id: f.id });
        return true;
      }
      if (folderPrompt.mode === "rename" && folderPrompt.folderId) {
        const id = folderPrompt.folderId;
        const ok = await updateFolder(id, { name: clean });
        if (!ok) { showToast(t("error.generic"), "error"); return false; }
        patchFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: clean } : f)));
      }
      return true;
    },
    [folderPrompt, patchFolders, selectView, showToast, t],
  );

  const onAskDeleteFolder = useCallback(
    (id: string) => {
      const label = folders.find((f) => f.id === id)?.name ?? "";
      setDeletePrompt({ open: true, kind: "folder", id, label });
    },
    [folders],
  );

  // ── Note actions ───────────────────────────────────────────────────────

  const creatingRef = useRef(false);
  const onCreateNote = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      /* A new note must be VISIBLE where it lands: from Pinned / Shared /
         Trash switch to All Notes, and drop an active search. */
      const needsAll = selection.kind === "smart" && (selection.key === "pinned" || selection.key === "shared" || selection.key === "trash");
      const nextSel: FolderSelection = needsAll ? { kind: "smart", key: "all" } : selection;
      const folderId = nextSel.kind === "folder" ? nextSel.id : null;

      const n = await createNote({
        title: "",
        folder_id: folderId,
        body_json: { type: "doc", content: [{ type: "paragraph" }] },
      });
      if (!n) { showToast(t("error.generic"), "error"); return; }

      const nextKey = queryKeyOf(nextSel, "");
      const keyChanged = nextKey !== queryKeyRef.current;
      if (needsAll) setSelection(nextSel);
      if (search || debouncedSearch) { setSearch(""); setDebouncedSearch(""); }

      // Show + select the new note IMMEDIATELY; the reload refreshes metadata.
      setListState((prev) => {
        const base =
          prev && prev.q === nextKey
            ? prev.rows
            : nextKey === queryKeyOf({ kind: "smart", key: "all" }, "") ? warmListRef.current ?? [] : [];
        return { q: nextKey, rows: sortNotes([n, ...base.filter((x) => x.id !== n.id)]) };
      });
      bumpBase(baseRef.current, n.id, n.updated_at);
      skipFetchRef.current = n.id;
      setActiveNote({ ...n, role: "owner" });
      setActiveNoteId(n.id);
      if (!keyChanged) void reloadNotes(); // otherwise the key change reloads
      if (folderId) void refreshFolders();
    } finally {
      creatingRef.current = false;
    }
  }, [selection, search, debouncedSearch, reloadNotes, refreshFolders, showToast, t]);

  useOpenOnNewParam(() => { void onCreateNote(); });

  /* Deep link: /notes?id=<noteId> opens that note. */
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const id = url.searchParams.get("id");
      if (!id) return;
      url.searchParams.delete("id");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      if (UUID_RE.test(id)) setActiveNoteId(id);
    } catch { /* ignore */ }
  }, []);

  const onTogglePin = useCallback(
    async (id: string, nextPinned: boolean) => {
      const apply = (v: boolean) => {
        setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? { ...n, is_pinned: v } : n))));
        setActiveNote((cur) => (cur?.id === id ? { ...cur, is_pinned: v } : cur));
      };
      apply(nextPinned);
      const res = await updateNote(id, { is_pinned: nextPinned });
      if (!res.ok) {
        apply(!nextPinned);
        showToast(t("error.generic"), "error");
        return;
      }
      bumpBase(baseRef.current, id, res.updated_at);
      if (selection.kind === "smart" && selection.key === "pinned") void reloadNotes();
    },
    [setNotes, selection, reloadNotes, showToast, t],
  );

  const onDeleteNote = useCallback(
    (id: string) => {
      const target = notesRef.current?.find((n) => n.id === id) ?? (activeNoteRef.current?.id === id ? activeNoteRef.current : null);
      const label = target?.title?.trim() || t("untitled");
      setDeletePrompt({ open: true, kind: "trash", id, label });
    },
    [t],
  );

  const onAskRenameNote = useCallback((id: string) => {
    const target = notesRef.current?.find((n) => n.id === id);
    if (!target) return;
    setNotePrompt({ open: true, id, initial: target.title ?? "" });
  }, []);

  const submitRenameNote = useCallback(
    async (name: string): Promise<boolean> => {
      if (!notePrompt.open) return true;
      const id = notePrompt.id;
      const next = name.trim().slice(0, NOTE_LIMITS.title);
      const res = await updateNote(id, { title: next }, { base: baseRef.current.get(id) ?? null });
      if (!res.ok) {
        if (res.conflict) {
          bumpBase(baseRef.current, id, res.note.updated_at);
          setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: res.note.title } : n)));
          if (activeNoteIdRef.current === id) {
            setActiveNote(res.note);
            setContentVersion((v) => v + 1);
          }
          showToast(t("conflict"), "info");
          return true;
        }
        showToast(t("error.generic"), "error");
        return false;
      }
      bumpBase(baseRef.current, id, res.updated_at);
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: next } : n)));
      setActiveNote((cur) => (cur?.id === id ? { ...cur, title: next } : cur));
      if (activeNoteIdRef.current === id) {
        setTitleSignal((s) => ({ id, title: next, seq: (s?.seq ?? 0) + 1 }));
      }
      return true;
    },
    [notePrompt, setNotes, showToast, t],
  );

  const onRestoreNote = useCallback(
    async (id: string) => {
      const ok = await restoreNote(id);
      if (!ok) { showToast(t("error.generic"), "error"); return; }
      if (activeNoteIdRef.current === id) closeNote();
      await reloadNotes();
      void refreshFolders();
    },
    [reloadNotes, refreshFolders, closeNote, showToast, t],
  );

  const onPurgeNote = useCallback(
    (id: string) => {
      const target = notesRef.current?.find((n) => n.id === id);
      const label = target?.title?.trim() || t("untitled");
      setDeletePrompt({ open: true, kind: "purge", id, label });
    },
    [t],
  );

  const onEmptyTrash = useCallback(() => {
    setDeletePrompt({ open: true, kind: "emptyTrash" });
  }, []);

  const onMoveNote = useCallback(
    async (id: string, folderId: string | null) => {
      const res = await updateNote(id, { folder_id: folderId });
      if (!res.ok) { showToast(t("error.generic"), "error"); return; }
      bumpBase(baseRef.current, id, res.updated_at);
      setActiveNote((cur) => (cur?.id === id ? { ...cur, folder_id: folderId } : cur));
      void reloadNotes();
      void refreshFolders();
    },
    [reloadNotes, refreshFolders, showToast, t],
  );

  /* Runs when the user confirms the delete dialog. Dispatches on the stored
     kind — trash / purge / empty-trash / folder. Stays open on failure. */
  const handleConfirmDelete = useCallback(async () => {
    if (!deletePrompt.open) return;
    setDeleteBusy(true);
    let ok = false;
    try {
      if (deletePrompt.kind === "trash" && deletePrompt.id) {
        const id = deletePrompt.id;
        ok = await deleteNote(id);
        if (ok) {
          setNotes((prev) => prev.filter((n) => n.id !== id));
          if (activeNoteIdRef.current === id) closeNote();
        }
      } else if (deletePrompt.kind === "purge" && deletePrompt.id) {
        const id = deletePrompt.id;
        ok = await purgeNote(id);
        if (ok) {
          setNotes((prev) => prev.filter((n) => n.id !== id));
          if (activeNoteIdRef.current === id) closeNote();
        }
      } else if (deletePrompt.kind === "emptyTrash") {
        ok = await emptyTrash();
        if (ok) {
          setNotes((prev) => prev.filter((n) => !n.deleted_at));
          if (activeNoteRef.current?.deleted_at) closeNote();
        }
      } else if (deletePrompt.kind === "folder" && deletePrompt.id) {
        const id = deletePrompt.id;
        ok = await deleteFolder(id);
        if (ok) {
          patchFolders((prev) => prev.filter((f) => f.id !== id));
          if (selection.kind === "folder" && selection.id === id) selectView({ kind: "smart", key: "all" });
          else void reloadNotes();
        }
      }
    } finally {
      setDeleteBusy(false);
    }
    if (!ok) { showToast(t("error.generic"), "error"); return; }
    setDeletePrompt({ open: false });
    void refreshFolders();
  }, [deletePrompt, selection, setNotes, closeNote, patchFolders, selectView, reloadNotes, refreshFolders, showToast, t]);

  // ── Editor auto-save ────────────────────────────────────────────────────

  const onNoteChange = useCallback(
    async (id: string, updates: EditorChange, opts?: { keepalive?: boolean }): Promise<SaveResult> => {
      setSaving("saving");
      if (savedTimer.current) { clearTimeout(savedTimer.current); savedTimer.current = null; }

      // Title rules (match Apple Notes):
      //  1. If the user explicitly typed in the title input, save that
      //     verbatim — even if it's empty (clearing is allowed).
      //  2. Otherwise, if the body changed AND the current saved title
      //     is empty, derive a title from the first line of the body.
      //     Never overwrite a title the user already set.
      // The saved title is read from refs, never from a stale closure, and
      // for THIS note id (edits can belong to a note no longer on screen).
      const row = notesRef.current?.find((n) => n.id === id);
      const currentTitle =
        row?.title ?? (activeNoteRef.current?.id === id ? activeNoteRef.current.title ?? "" : null);
      let title: string | undefined;
      if (updates.title !== undefined) {
        title = updates.title;
      } else if (updates.body_json !== undefined && currentTitle !== null && !currentTitle.trim()) {
        const derived = deriveAutoTitle(updates.body_json);
        if (derived) title = derived;
      }

      const patch: NotePatch = {};
      if (title !== undefined) patch.title = title;
      if (updates.body_json !== undefined) patch.body_json = updates.body_json;
      if (updates.color !== undefined) patch.color = updates.color;
      if (updates.tags !== undefined) patch.tags = updates.tags;

      const res = await updateNote(id, patch, {
        base: baseRef.current.get(id) ?? null,
        keepalive: opts?.keepalive,
      });

      if (res.ok) {
        bumpBase(baseRef.current, id, res.updated_at);
        const nowIso = res.updated_at ?? new Date().toISOString();
        const preview =
          updates.body_json !== undefined
            ? extractPlainText(updates.body_json).slice(0, NOTE_LIMITS.preview)
            : undefined;
        // Reflect the change in the list without a full reload.
        setNotes((prev) =>
          sortNotes(
            prev.map((n) =>
              n.id === id
                ? {
                    ...n,
                    title: title ?? n.title,
                    body_plain: preview ?? n.body_plain,
                    color: updates.color !== undefined ? updates.color : n.color,
                    tags: updates.tags ?? n.tags,
                    updated_at: nowIso,
                  }
                : n,
            ),
          ),
        );
        setActiveNote((cur) => (cur?.id === id ? { ...cur, ...patch, updated_at: nowIso } : cur));
        setSaving("saved");
        savedTimer.current = setTimeout(() => setSaving((s) => (s === "saved" ? "idle" : s)), 1200);
        return "ok";
      }

      if (res.conflict) {
        const fresh = res.note;
        baseRef.current.set(id, fresh.updated_at);
        setNotes((prev) =>
          prev.map((n) =>
            n.id === id
              ? { ...n, title: fresh.title, body_plain: (fresh.body_plain ?? "").slice(0, NOTE_LIMITS.preview), updated_at: fresh.updated_at }
              : n,
          ),
        );
        if (activeNoteIdRef.current === id) {
          setActiveNote(fresh);
          setContentVersion((v) => v + 1);
        }
        setSaving("idle");
        showToast(t("conflict"), "info");
        return "conflict";
      }

      setSaving("error");
      return "error";
    },
    [setNotes, showToast, t],
  );

  const onRemoteApplied = useCallback(
    (fresh: NoteFull) => {
      baseRef.current.set(fresh.id, fresh.updated_at);
      setActiveNote((cur) => (cur?.id === fresh.id ? { ...fresh, role: fresh.role ?? cur.role } : cur));
      setNotes((prev) =>
        prev.map((n) =>
          n.id === fresh.id
            ? { ...n, title: fresh.title, body_plain: (fresh.body_plain ?? "").slice(0, NOTE_LIMITS.preview), updated_at: fresh.updated_at }
            : n,
        ),
      );
    },
    [setNotes],
  );

  const onShareChanged = useCallback(() => {
    void reloadNotes();
    const id = activeNoteIdRef.current;
    if (!id) return;
    void fetchNote(id).then((n) => {
      if (n) setActiveNote((cur) => (cur?.id === n.id ? { ...cur, is_shared: n.is_shared } : cur));
    });
  }, [reloadNotes]);

  const onLeftNote = useCallback(
    (noteId: string) => {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (activeNoteIdRef.current === noteId) closeNote();
    },
    [setNotes, closeNote],
  );

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  const shortcutState = useRef({ onCreateNote, deletePrompt, deleteBusy, closeNote, anyDialog: false });
  useEffect(() => {
    shortcutState.current = {
      onCreateNote,
      deletePrompt,
      deleteBusy,
      closeNote,
      anyDialog: folderPrompt.open || notePrompt.open || shareOpen,
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = shortcutState.current;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === "n" || e.key === "N")) {
        if (isTypingTarget(e.target) || s.anyDialog || s.deletePrompt.open) return;
        e.preventDefault();
        void s.onCreateNote();
        return;
      }
      if (mod && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        const el = searchInputRef.current;
        if (el) { el.focus(); try { el.select(); } catch { /* */ } }
        return;
      }
      if (e.key === "Escape") {
        if (s.deletePrompt.open) {
          if (!s.deleteBusy) setDeletePrompt({ open: false });
          return;
        }
        if (s.anyDialog) return; // those dialogs handle their own Escape
        if (e.target === searchInputRef.current) {
          setSearch("");
          searchInputRef.current?.blur();
          return;
        }
        if (isTypingTarget(e.target)) return;
        if (document.querySelector("[role='dialog'],[role='alertdialog']")) return;
        if (activeNoteIdRef.current) s.closeNote();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────

  const isTrashView = selection.kind === "smart" && selection.key === "trash";

  const selectionLabel =
    selection.kind === "folder"
      ? folders.find((f) => f.id === selection.id)?.name ?? "—"
      : selection.key === "all"
        ? t("smart.allNotes")
        : selection.key === "pinned"
          ? t("smart.pinned")
          : selection.key === "none"
            ? t("smart.none")
            : selection.key === "shared"
              ? t("smart.shared")
              : t("smart.trash");

  const totalNotes = notes?.length ?? 0;

  /* Phones have no folders pane — a compact picker sits in the list header. */
  const folderPaths = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f] as const));
    return folders
      .map((f) => {
        const parts = [f.name];
        const seen = new Set([f.id]);
        let cur: NotesFolderRow | undefined = f;
        while (cur?.parent_id && !seen.has(cur.parent_id)) {
          const p = byId.get(cur.parent_id);
          if (!p) break;
          seen.add(p.id);
          parts.unshift(p.name);
          cur = p;
        }
        return { id: f.id, path: parts.join(" / ") };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [folders]);
  const mobilePicker = (
    <select
      className="md:hidden mt-2 w-full h-9 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
      aria-label={t("list.folder")}
      value={selection.kind === "folder" ? `folder:${selection.id}` : `smart:${selection.key}`}
      onChange={(e) => {
        const [kind, val] = e.target.value.split(":");
        if (kind === "folder") selectView({ kind: "folder", id: val });
        else selectView({ kind: "smart", key: val as "all" | "pinned" | "none" | "shared" | "trash" });
      }}
    >
      <option value="smart:all">{t("smart.allNotes")}</option>
      <option value="smart:pinned">{t("smart.pinned")}</option>
      <option value="smart:none">{t("smart.none")}</option>
      <option value="smart:shared">{t("smart.shared")}</option>
      {folderPaths.map((f) => (
        <option key={f.id} value={`folder:${f.id}`}>{f.path}</option>
      ))}
      <option value="smart:trash">{t("smart.trash")}</option>
    </select>
  );

  const deleteTitle = !deletePrompt.open
    ? ""
    : deletePrompt.kind === "trash"
      ? `${t("moveToTrash")} — "${deletePrompt.label ?? ""}"?`
      : deletePrompt.kind === "purge"
        ? `${t("deleteForever")} — "${deletePrompt.label ?? ""}"?`
        : deletePrompt.kind === "emptyTrash"
          ? t("emptyTrash")
          : t("deleteFolder");
  const deleteMessage = !deletePrompt.open
    ? ""
    : deletePrompt.kind === "purge"
      ? t("confirm.purgeDesc")
      : deletePrompt.kind === "emptyTrash"
        ? t("emptyTrashConfirm")
        : deletePrompt.kind === "folder"
          ? t("deleteFolderConfirm")
          : t("confirm.trashDesc");
  const deleteConfirmLabel = !deletePrompt.open
    ? t("dialog.ok")
    : deletePrompt.kind === "trash"
      ? t("moveToTrash")
      : deletePrompt.kind === "purge"
        ? t("deleteForever")
        : deletePrompt.kind === "emptyTrash"
          ? t("emptyTrash")
          : t("delete");

  // RootShell already renders MainHeader (top) and Sidebar (left), and it has
  // ALREADY subtracted the header — so this fills its parent with `h-full`.
  return (
    <div className="h-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full">
      {/* ── PAGE HEADER — canonical Hub PageHeader (hidden on phones while a
          note is open, so the editor gets the screen) ── */}
      <div className={`shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] w-full ${activeNoteId ? "hidden md:block" : ""}`}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 min-w-0 pt-5 pb-3">
          <PageHeader
            title={t("app.title")}
            subtitle={`${t("app.subtitle")} · ${totalNotes} ${t(totalNotes === 1 ? "count.note" : "count.notes")}`}
            icon={<NotesIcon size={16} />}
            showTabs={false}
          />

          {/* Brand-aligned tile menu — same across every Hub app */}
          <div className="mt-5 mb-3">
            <AppHomeMenu
              hideSearch
              navItems={[
                { key: "all",     onClick: () => selectView({ kind: "smart", key: "all" }),    icon: "document", label: t("smart.allNotes"), active: selection.kind === "smart" && selection.key === "all" },
                { key: "pinned",  onClick: () => selectView({ kind: "smart", key: "pinned" }), icon: <PinIcon className="h-[13px] w-[13px]" />,   label: t("smart.pinned"),  active: selection.kind === "smart" && selection.key === "pinned" },
                { key: "none",    onClick: () => selectView({ kind: "smart", key: "none" }),   icon: "file",     label: t("smart.none"), active: selection.kind === "smart" && selection.key === "none" },
                { key: "shared",  onClick: () => selectView({ kind: "smart", key: "shared" }), icon: <UsersIcon className="h-[13px] w-[13px]" />, label: t("nav.shared"),  active: selection.kind === "smart" && selection.key === "shared" },
                { key: "trash",   onClick: () => selectView({ kind: "smart", key: "trash" }),  icon: "recycle",  label: t("nav.trash"),   active: selection.kind === "smart" && selection.key === "trash" },
                { key: "new",     onClick: () => { void onCreateNote(); },                     icon: "plus",     label: t("newNote") },
              ]}
              searchPlaceholder={searchPlaceholder}
            />
          </div>

          {/* Search + quick New Note */}
          <div className="flex items-center gap-2 pb-3 min-w-0">
            <div className="flex-1 min-w-0 flex items-center bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-3 md:px-4 gap-2 md:gap-3 focus-within:border-[var(--border-focus)] transition-all">
              <SearchIcon className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
              <input
                ref={searchInputRef}
                type="search"
                dir="auto"
                value={search}
                maxLength={NOTE_LIMITS.search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search")}
                aria-label={t("search")}
                className="flex-1 min-w-0 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none h-10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={t("search.clear")}
                  className="p-0.5 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                >
                  <CrossIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button onClick={() => { void onCreateNote(); }} icon={<PlusIcon className="h-3.5 w-3.5" />} aria-label={t("newNote")} title={t("newNote")}>
              <span className="hidden md:inline">{t("newNote")}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Focus mode toggle — only meaningful with a note open, md+ only. */}
      {activeNoteId && (
        <div className="hidden md:block shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/95">
          <div className="max-w-[1600px] mx-auto flex items-center justify-end gap-2 px-4 md:px-6 lg:px-8 py-2">
            <button
              type="button"
              onClick={toggleFocus}
              title={focusMode ? t("focus.exitTip") : t("focus.enterTip")}
              aria-pressed={focusMode}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
                focusMode
                  ? "border-[var(--bg-inverted)] bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                  : "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Maximize2Icon className="h-3 w-3" />
              {focusMode ? t("focus.exit") : t("focus.enter")}
            </button>
          </div>
        </div>
      )}

      {/* ── BODY ── 3 panes on md+, drill-down on phones. */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`h-full grid grid-cols-1 ${focused ? "md:grid-cols-1" : "md:grid-cols-[200px_260px_1fr]"}`}>
          {/* Pane 1 — Folders */}
          <div className={`hidden ${focused ? "" : "md:block"} kx-glass-drawer border-e border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 overflow-y-auto`}>
            <FoldersSidebar
              folders={folders}
              selection={selection}
              onSelect={selectView}
              onAskCreateFolder={onAskCreateFolder}
              onAskRenameFolder={onAskRenameFolder}
              onAskDeleteFolder={onAskDeleteFolder}
              notesCountByFolder={folderCounts}
            />
          </div>

          {/* Pane 2 — Notes list */}
          <div className={`${activeNoteId ? "hidden" : "block"} ${focused ? "md:hidden" : "md:block"} kx-glass-drawer border-e border-[var(--border-subtle)] overflow-hidden min-h-0`}>
            <NotesList
              notes={notes}
              activeId={activeNoteId}
              onSelect={setActiveNoteId}
              onCreate={() => { void onCreateNote(); }}
              onTogglePin={(id, next) => { void onTogglePin(id, next); }}
              onRename={onAskRenameNote}
              onDelete={onDeleteNote}
              onRestore={(id) => { void onRestoreNote(id); }}
              onPurge={onPurgeNote}
              onEmptyTrash={onEmptyTrash}
              hasSearch={!!debouncedSearch}
              isTrashView={isTrashView}
              selectionLabel={selectionLabel}
              headerExtra={mobilePicker}
            />
          </div>

          {/* Pane 3 — Editor */}
          <div className={`${activeNoteId ? "block" : "hidden"} md:block overflow-hidden min-h-0`}>
            <NoteEditor
              note={activeNote}
              contentVersion={contentVersion}
              folders={folders}
              readOnly={isTrashView}
              saving={saving}
              me={collabMe}
              titleSignal={titleSignal}
              notify={showToast}
              onBack={closeNote}
              onShare={() => { if (activeNote) setShareOpen(true); }}
              onChange={onNoteChange}
              onRemoteApplied={onRemoteApplied}
              onMove={(folderId) => {
                if (!activeNote) return;
                void onMoveNote(activeNote.id, folderId);
              }}
              onTogglePin={() => {
                if (!activeNote) return;
                void onTogglePin(activeNote.id, !activeNote.is_pinned);
              }}
              onDelete={() => {
                if (!activeNote) return;
                onDeleteNote(activeNote.id);
              }}
              onRestore={() => {
                if (!activeNote) return;
                void onRestoreNote(activeNote.id);
              }}
              onPurge={() => {
                if (!activeNote) return;
                onPurgeNote(activeNote.id);
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────── */}
      <PromptDialog
        open={folderPrompt.open}
        title={folderPrompt.open && folderPrompt.mode === "rename" ? t("rename") : folderPrompt.open && folderPrompt.parentId ? t("newSubfolder") : t("newFolder")}
        label={t("folderName")}
        placeholder={t("folderName")}
        initialValue={folderPrompt.open ? folderPrompt.initial : ""}
        confirmLabel={t("dialog.ok")}
        onConfirm={submitFolderPrompt}
        onClose={() => setFolderPrompt({ open: false })}
      />

      <PromptDialog
        open={notePrompt.open}
        title={t("rename")}
        label={t("noteName")}
        placeholder={t("untitled")}
        initialValue={notePrompt.open ? notePrompt.initial : ""}
        confirmLabel={t("dialog.ok")}
        onConfirm={submitRenameNote}
        onClose={() => setNotePrompt({ open: false })}
      />

      <ShareDialog
        noteId={shareOpen && activeNote ? activeNote.id : null}
        open={shareOpen && !!activeNote}
        onClose={() => setShareOpen(false)}
        onChanged={onShareChanged}
        meId={collabMe?.id ?? null}
        onLeft={onLeftNote}
        notify={showToast}
      />

      <ConfirmDialog
        open={deletePrompt.open}
        tone="danger"
        busy={deleteBusy}
        title={deleteTitle}
        message={deleteMessage}
        confirmLabel={deleteConfirmLabel}
        cancelLabel={t("dialog.cancel")}
        onConfirm={() => { void handleConfirmDelete(); }}
        onCancel={() => { if (!deleteBusy) setDeletePrompt({ open: false }); }}
      />

      {toastElement}
    </div>
  );
}
