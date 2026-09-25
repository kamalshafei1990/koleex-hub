"use client";

/* ---------------------------------------------------------------------------
   NoteEditor — right pane. TipTap-based rich text editor with:
     • Title input + tags + note style (colour tint / paper)
     • A grouped formatting toolbar (text style, colour, alignment, lists,
       insert: link/image/table/divider, history)
     • Auto-save (500ms debounce) with a Saving… / Saved / Not saved + Retry
       indicator. Pending edits are keyed by note id and are FLUSHED — never
       dropped — when the note changes, the editor unmounts, or the tab is
       hidden / closed (keepalive request).
     • Sharing: a Share button + live collaborator presence (avatars)
     • LIVE CO-EDITING on shared notes (Yjs over the note's realtime channel,
       end-to-end encrypted — src/lib/notes-yjs.ts). The editor is rebuilt
       with the Collaboration extension once the session has joined; saves
       then send the Yjs state, which the server MERGES (no 409s). Where
       collaboration is unavailable it falls back to the single-editor path
       (a peer's save pings us and we re-fetch). A fallback save on a live
       note is merged into the Yjs state server-side (409 when stale) and
       live peers pull it; a transient fallback keeps retrying and REJOINS
       — pending edits are saved first, then the editor rebinds.
     • "/" block menu, "[[" note links + Backlinks, checklist → To-do,
       version history, Koleex AI (summary / action items), duplicate,
       Markdown export, print / PDF, Send to Discuss, a phone keyboard bar
     • Move-to-folder, Pin, Delete; read-only for trash + view-only sharees
   Loaded with next/dynamic from NotesApp, so the list paints before TipTap.
   --------------------------------------------------------------------------- */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useEditor, useEditorState, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration, { isChangeOrigin } from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";

import { useTranslation } from "@/lib/i18n";
import { notesT } from "@/lib/translations/notes";
import {
  createTodoFromNote,
  fetchNote,
  fetchNotes,
  saveVersion,
  uploadNoteImage,
  type NoteAiResult,
  type NoteFull,
  type NoteRow,
  type NoteVersionFull,
  type NotesFolderRow,
} from "@/lib/notes";
import { NOTES_IMAGE_MIME } from "@/lib/notes-policy";
import { getTabClientId, useNoteCollab, type NoteUpdate } from "@/lib/note-collab";
import { NOTES_YJS_FIELD, noteLinkHref, notesSchemaExtensions, parseNoteLink } from "@/lib/notes-schema";
import { NoteYjsSession, fetchCollabJoin, peerColor } from "@/lib/notes-yjs";
import { noteFileName, noteToMarkdown } from "@/lib/notes-markdown";
import ConfirmDialog from "@/components/kds/ConfirmDialog";
import { NoteLinkPicker, SlashCommand, type MenuBridge, type MenuItem } from "./editor-extensions";
import SuggestionMenu, { useMenuBridge } from "./SuggestionMenu";
import { AiPanel, Backlinks, HistoryPanel } from "./NotePanels";
import SendToDiscussDialog from "./SendToDiscussDialog";
import { ChecklistTodoControl, MobileFormatBar, taskItemAtSelection } from "./EditorFloatingBars";
import PinIcon from "@/components/icons/ui/PinIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import NotesIcon from "@/components/icons/NotesIcon";
import BoldIcon from "@/components/icons/ui/BoldIcon";
import ItalicIcon from "@/components/icons/ui/ItalicIcon";
import UnderlineIcon from "@/components/icons/ui/UnderlineIcon";
import StrikethroughIcon from "@/components/icons/ui/StrikethroughIcon";
import HighlighterIcon from "@/components/icons/ui/HighlighterIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import ListOrderedIcon from "@/components/icons/ui/ListOrderedIcon";
import CheckSquareIcon from "@/components/icons/ui/CheckSquareIcon";
import QuoteIcon from "@/components/icons/ui/QuoteIcon";
import CodeIcon from "@/components/icons/ui/CodeIcon";
import FileCode2Icon from "@/components/icons/ui/FileCode2Icon";
import LinkIcon from "@/components/icons/ui/LinkIcon";
import Undo2Icon from "@/components/icons/ui/Undo2Icon";
import Redo2Icon from "@/components/icons/ui/Redo2Icon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import AlignLeftIcon from "@/components/icons/ui/AlignLeftIcon";
import AlignCenterIcon from "@/components/icons/ui/AlignCenterIcon";
import AlignRightIcon from "@/components/icons/ui/AlignRightIcon";
import MinusIcon from "@/components/icons/ui/MinusIcon";
import TableIcon from "@/components/icons/ui/TableIcon";
import RemoveFormattingIcon from "@/components/icons/ui/RemoveFormattingIcon";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import MoreHorizontalIcon from "@/components/icons/ui/MoreHorizontalIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import PrintIcon from "@/components/icons/ui/PrintIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import BookmarkIcon from "@/components/icons/ui/BookmarkIcon";
import Heading1Icon from "@/components/icons/ui/Heading1Icon";
import Heading2Icon from "@/components/icons/ui/Heading2Icon";
import Heading3Icon from "@/components/icons/ui/Heading3Icon";
import FileIcon from "@/components/icons/ui/FileIcon";
import { PromptDialog } from "./NotesDialog";

type T = (k: string) => string;

/* ---------------------------------------------------------------------------
   Note surfaces — the value stored in `notes.color`. Two families:
     • Colour tints — each has a LIGHT and a DARK wash (Tailwind `dark:`
       follows the Hub's data-theme), so the ink (--text-primary) stays
       readable in both themes. Stored keys are the historical dark hex
       values, so existing notes keep their colour.
     • Paper styles (realistic light pages — ruled / grid / dots / legal pad).
       Light pages flip the ink to dark via the `notes-surface-light` class.
   No DB change: everything is encoded in the existing `color` text column.
   --------------------------------------------------------------------------- */
type NoteSurface = {
  key: string;                 // stored value ("default" → null)
  labelKey: string;
  light?: boolean;             // light page → dark ink
  ruled?: boolean;             // draw notebook rules on the prose itself
  ruleColor?: string;          // rule colour (used when ruled)
  tintClass?: string;          // theme-paired background (tints)
  surface: CSSProperties;      // applied to the writing area
  swatch: CSSProperties;       // mini preview in the picker
};

const RULE = "#c2d2ee";        // notebook rule colour
const GRID = "#e1e1e1";        // grid line colour
const DOT = "#cdcdcd";         // dot colour
const PAD = "#fbf5c9";         // legal-pad paper
const PAD_RULE = "#d9c987";    // legal-pad rule

const NOTE_SURFACES: NoteSurface[] = [
  { key: "default", labelKey: "surface.default", surface: {}, swatch: { background: "var(--bg-surface)" } },
  // Colour tints — light wash / dark wash
  { key: "#3a3a3a", labelKey: "surface.gray",   tintClass: "bg-[#ececec] dark:bg-[#3a3a3a]", surface: {}, swatch: {} },
  { key: "#16324f", labelKey: "surface.blue",   tintClass: "bg-[#dde8f5] dark:bg-[#16324f]", surface: {}, swatch: {} },
  { key: "#173a2b", labelKey: "surface.green",  tintClass: "bg-[#dcefe3] dark:bg-[#173a2b]", surface: {}, swatch: {} },
  { key: "#3d3014", labelKey: "surface.amber",  tintClass: "bg-[#f6ebcf] dark:bg-[#3d3014]", surface: {}, swatch: {} },
  { key: "#3d1c1c", labelKey: "surface.red",    tintClass: "bg-[#f7dddd] dark:bg-[#3d1c1c]", surface: {}, swatch: {} },
  { key: "#2c1f3d", labelKey: "surface.purple", tintClass: "bg-[#e8e0f3] dark:bg-[#2c1f3d]", surface: {}, swatch: {} },
  // Paper styles (light pages)
  {
    key: "paper-lined", labelKey: "surface.ruled", light: true, ruled: true, ruleColor: RULE,
    surface: { backgroundColor: "#ffffff" },
    swatch: {
      backgroundColor: "#ffffff",
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 3px, ${RULE} 4px)`,
    },
  },
  {
    key: "paper-grid", labelKey: "surface.grid", light: true,
    surface: {
      backgroundColor: "#ffffff",
      backgroundImage: `linear-gradient(to right, ${GRID} 1px, transparent 1px), linear-gradient(to bottom, ${GRID} 1px, transparent 1px)`,
      backgroundSize: "24px 24px",
    },
    swatch: {
      backgroundColor: "#ffffff",
      backgroundImage: `linear-gradient(to right, ${GRID} 1px, transparent 1px), linear-gradient(to bottom, ${GRID} 1px, transparent 1px)`,
      backgroundSize: "5px 5px",
    },
  },
  {
    key: "paper-dots", labelKey: "surface.dots", light: true,
    surface: {
      backgroundColor: "#ffffff",
      backgroundImage: `radial-gradient(${DOT} 1.3px, transparent 1.4px)`,
      backgroundSize: "20px 20px",
    },
    swatch: {
      backgroundColor: "#ffffff",
      backgroundImage: `radial-gradient(${DOT} 1px, transparent 1.2px)`,
      backgroundSize: "5px 5px",
    },
  },
  {
    key: "pad-yellow", labelKey: "surface.legal", light: true, ruled: true, ruleColor: PAD_RULE,
    surface: { backgroundColor: PAD },
    swatch: {
      backgroundColor: PAD,
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 3px, ${PAD_RULE} 4px)`,
    },
  },
];

const DEFAULT_SURFACE = NOTE_SURFACES[0];

function resolveSurface(value: string | null | undefined): NoteSurface {
  if (!value) return DEFAULT_SURFACE;
  const found = NOTE_SURFACES.find((s) => s.key === value);
  if (found) return found;
  // Legacy / arbitrary hex → treat as a solid tint.
  return { key: value, labelKey: "surface.custom", surface: { background: value }, swatch: { background: value } };
}

/* Inline font colours for the text-colour picker (all readable on both the
   light and dark grounds — no pure white). */
const TEXT_COLORS = ["#567FB2", "#E5484D", "#0FA968", "#E8A33D", "#9B7BE0", "#888888"];

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

/* Rejoin backoff for a note that fell back to the single-editor path. */
const JOIN_RETRY_MIN_MS = 15_000;
const JOIN_RETRY_MAX_MS = 120_000;

export type EditorChange = {
  title?: string;
  /** Always the editor's current document (also in collab mode, where it
   *  is kept for the local preview / auto-title and NOT sent). */
  body_json?: unknown;
  color?: string | null;
  tags?: string[];
  /** Collaborative save: the full Yjs state (base64). */
  yjs_update?: string;
  /** Collab mode: saves are merges — no concurrency token, no 409. */
  collab?: boolean;
};

export type SaveResult = "ok" | "error" | "conflict";
export type SaveState = "idle" | "saving" | "saved" | "error";

export interface NoteEditorProps {
  note: NoteFull | null;
  /** Bump to make the editor replace its content from `note` (e.g. after a
   *  save conflict reloaded the note). */
  contentVersion: number;
  folders: NotesFolderRow[];
  readOnly: boolean;
  saving: SaveState;
  me: { id: string; name: string } | null;
  /** Persist changes for `noteId` (explicit — pending edits may belong to a
   *  note that is no longer on screen). */
  onChange: (noteId: string, updates: EditorChange, opts?: { keepalive?: boolean }) => Promise<SaveResult>;
  /** A peer's save was pulled in and applied. */
  onRemoteApplied: (fresh: NoteFull) => void;
  onMove: (folderId: string | null) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onPurge: () => void;
  onShare: () => void;
  /** Phones: return to the list. */
  onBack?: () => void;
  /** Open another note (a [[link]] or a backlink was clicked). */
  onOpenNote: (id: string) => void;
  /** Copy this note into a new one. */
  onDuplicate: () => void;
  /** The title was changed outside the editor (Rename dialog). */
  titleSignal?: { id: string; title: string; seq: number } | null;
  notify: (msg: string, kind?: "success" | "error" | "info") => void;
}

/** A collaborator's caret: a coloured bar with their name. */
function renderCaret(user: Record<string, unknown>): HTMLElement {
  const color = typeof user.color === "string" ? user.color : "#567FB2";
  const caret = document.createElement("span");
  caret.classList.add("collaboration-carets__caret");
  caret.style.borderColor = color;
  const label = document.createElement("div");
  label.classList.add("collaboration-carets__label");
  label.style.backgroundColor = color;
  label.setAttribute("dir", "auto");
  label.textContent = typeof user.name === "string" && user.name ? user.name : "•";
  caret.append(label);
  return caret;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/* A clean, print-only page for "Print / Save as PDF". */
const PRINT_CSS = `
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { font: 12pt/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", "PingFang SC", sans-serif; color: #111; margin: 0; }
  h1.note-title { font-size: 22pt; margin: 0 0 4pt; }
  .note-tags { color: #567FB2; font-size: 10pt; margin-bottom: 14pt; }
  h1 { font-size: 18pt; } h2 { font-size: 15pt; } h3 { font-size: 13pt; }
  h1, h2, h3 { margin: 14pt 0 6pt; break-after: avoid; }
  p { margin: 4pt 0; }
  a { color: #2F5C8A; }
  img { max-width: 100%; height: auto; border-radius: 6pt; break-inside: avoid; }
  blockquote { border-inline-start: 3px solid #bbb; margin: 8pt 0; padding-inline-start: 10pt; color: #444; }
  pre { background: #f4f4f4; border-radius: 6pt; padding: 8pt; white-space: pre-wrap; font-size: 10pt; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
  td, th { border: 1px solid #bbb; padding: 4pt 6pt; vertical-align: top; }
  th { background: #f0f0f0; }
  hr { border: 0; border-top: 1px solid #ccc; margin: 12pt 0; }
  ul[data-type="taskList"] { list-style: none; padding-inline-start: 0; }
  ul[data-type="taskList"] li { display: flex; gap: 6pt; align-items: flex-start; }
  ul[data-type="taskList"] li > label { flex: none; }
  ul[data-type="taskList"] li[data-checked="true"] > div { text-decoration: line-through; color: #777; }
  mark { background: #fff3a3; }
`;

function countWords(text: string): { words: number; chars: number } {
  const trimmed = text.trim();
  return { words: trimmed ? trimmed.split(/\s+/).length : 0, chars: text.length };
}

export default function NoteEditor({
  note,
  contentVersion,
  folders,
  readOnly,
  saving,
  me,
  onChange,
  onRemoteApplied,
  onMove,
  onTogglePin,
  onDelete,
  onRestore,
  onPurge,
  onShare,
  onBack,
  onOpenNote,
  onDuplicate,
  titleSignal,
  notify,
}: NoteEditorProps) {
  const { t, lang } = useTranslation(notesT);
  const [titleDraft, setTitleDraft] = useState(note?.title ?? "");
  const [tagsDraft, setTagsDraft] = useState<string[]>(note?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [counts, setCounts] = useState<{ words: number; chars: number }>({ words: 0, chars: 0 });
  const [colorOpen, setColorOpen] = useState(false);

  /* Link prompt + image upload state for the toolbar. */
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInitial, setLinkInitial] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const isTrashed = note?.deleted_at != null;
  const isViewer = note?.role === "viewer";
  const isSharee = note?.role === "viewer" || note?.role === "editor";

  /* ── Live co-editing session (shared notes) ─────────────────────────────
     `collab` records what was decided FOR WHICH NOTE: a shared note stays
     read-only until its session has joined (or collaboration was found to
     be unavailable → "off" → the single-editor path). Typing into a solo
     editor while the session is being set up would race the server seed. */
  const noteId = note?.id ?? null;
  const collabEligible = !!note && !isTrashed && (isSharee || !!note.is_shared) && !!me;
  const [session, setSession] = useState<NoteYjsSession | null>(null);
  /* `retry`: the fallback is transient (join or pre-join save failed) —
     the editor keeps trying to rejoin; false = collaboration is off for
     this note (server said so). */
  const [collab, setCollab] = useState<{ id: string | null; phase: "off" | "joining" | "live"; retry?: boolean }>({ id: null, phase: "off" });
  const [joinTick, setJoinTick] = useState(0);
  const fallbackRetry = collabEligible && !!noteId && collab.id === noteId && collab.phase === "off" && collab.retry === true;
  const activeSession = session && noteId && session.noteId === noteId ? session : null;
  const collabPending = collabEligible && !activeSession && !(collab.id === noteId && collab.phase === "off");
  const editingDisabled = readOnly || isTrashed || isViewer || collabPending;

  /* Side panels + dialogs of the 2026-09-26 additions. */
  const [panel, setPanel] = useState<"history" | "ai" | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [discussOpen, setDiscussOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<NoteVersionFull | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [todoBusy, setTodoBusy] = useState(false);
  const [mobileBar, setMobileBar] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  // Opening the menu moves focus to its first item (menu-button pattern).
  useEffect(() => {
    if (moreOpen) moreMenuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [moreOpen]);

  /* Latest values for callbacks that outlive a render (timers, listeners). */
  const noteRef = useRef(note);
  const noteIdRef = useRef<string | null>(note?.id ?? null);
  const disabledRef = useRef(editingDisabled);
  const onChangeRef = useRef(onChange);
  const sessionRef = useRef<NoteYjsSession | null>(activeSession);
  const onOpenNoteRef = useRef(onOpenNote);
  const fallbackRetryRef = useRef(fallbackRetry);
  useEffect(() => {
    fallbackRetryRef.current = fallbackRetry;
    noteRef.current = note;
    noteIdRef.current = note?.id ?? null;
    disabledRef.current = editingDisabled;
    onChangeRef.current = onChange;
    sessionRef.current = activeSession;
    onOpenNoteRef.current = onOpenNote;
  });

  const placeholderRef = useRef(`${t("editor.placeholder")}  ${t("slash.hint")}`);
  const lastLocalEditAt = useRef(0);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Save pipeline ──────────────────────────────────────────────────────
  /* Pending edits keyed by note id, one in-flight save per note (so each
     save carries the updated_at the previous one produced), and a single
     debounce timer that flushes everything pending. */
  const pendingRef = useRef<Map<string, EditorChange>>(new Map());
  const inflightRef = useRef<Map<string, Promise<void>>>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastRef = useRef<(o?: { body?: boolean }) => void>(() => {});

  const sendNote = useCallback(async (id: string, keepalive = false): Promise<void> => {
    if (!keepalive) {
      while (inflightRef.current.has(id)) {
        await inflightRef.current.get(id);
      }
    }
    const payload = pendingRef.current.get(id);
    if (!payload || Object.keys(payload).length === 0) return;
    pendingRef.current.delete(id);
    const p = onChangeRef.current(id, payload, { keepalive })
      .then((res) => {
        if (res === "ok") {
          // Tell peers only once the save has actually landed. In a live
          // session the body already reached them over the socket — ping
          // only for what is not in the Yjs doc (title / tags / colour).
          const metaChanged = "title" in payload || "tags" in payload || "color" in payload;
          if (id === noteIdRef.current && (!payload.yjs_update || metaChanged)) {
            // A single-editor body save is not in anyone's live doc yet:
            // flag it so live peers pull the merged state (the server
            // pings too — this covers a server without realtime config).
            broadcastRef.current({ body: !payload.yjs_update && "body_json" in payload });
          }
        } else if (res === "error") {
          // Keep the edits: newer pending changes win over the failed ones.
          pendingRef.current.set(id, { ...payload, ...(pendingRef.current.get(id) ?? {}) });
        }
        // "conflict": the parent reloaded the note; these edits are void.
        // A fallback client is stale because the live session moved on —
        // try to rejoin it rather than keep saving an old copy.
        else if (res === "conflict" && id === noteIdRef.current && fallbackRetryRef.current) {
          setJoinTick((n) => n + 1);
        }
      })
      .catch(() => {
        pendingRef.current.set(id, { ...payload, ...(pendingRef.current.get(id) ?? {}) });
      })
      .finally(() => {
        if (inflightRef.current.get(id) === p) inflightRef.current.delete(id);
      });
    inflightRef.current.set(id, p);
    await p;
  }, []);

  const flushAll = useCallback((keepalive = false) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    for (const id of Array.from(pendingRef.current.keys())) void sendNote(id, keepalive);
  }, [sendNote]);

  const queueChange = useCallback((next: EditorChange, immediate = false) => {
    const id = noteIdRef.current;
    if (!id || disabledRef.current) return;
    const live = sessionRef.current?.noteId === id;
    pendingRef.current.set(id, { ...(pendingRef.current.get(id) ?? {}), ...next, ...(live ? { collab: true } : {}) });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (immediate) { flushAll(); return; }
    // Live sessions already share every keystroke; persistence can breathe.
    saveTimer.current = setTimeout(() => { saveTimer.current = null; flushAll(); }, next.yjs_update ? 1500 : 500);
  }, [flushAll]);

  /* Flush on unmount, and with a keepalive request when the tab is hidden or
     the page is going away — the last half-second of typing survives. */
  useEffect(() => {
    const onHide = () => flushAll(true);
    const onVisibility = () => { if (document.visibilityState === "hidden") flushAll(true); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flushAll(true);
    };
  }, [flushAll]);

  /* "/" and "[[" menus — the extensions read these lazily. */
  const { bridge, menu, choose: chooseMenu, hover: hoverMenu } = useMenuBridge();
  const bridgeRef = useRef<MenuBridge | null>(bridge);
  useEffect(() => { bridgeRef.current = bridge; }, [bridge]);
  const slashItemsRef = useRef<(q: string) => MenuItem[]>(() => []);
  const linkItemsRef = useRef<(q: string) => Promise<MenuItem[]>>(async () => []);

  /* The editor is REBUILT when a live session starts or ends (the
     Collaboration extension binds to one Y.Doc for its whole life). A solo
     editor is reused across notes, exactly as before. */
  const editor = useEditor({
    extensions: [
      ...notesSchemaExtensions({ collab: !!activeSession }),
      Placeholder.configure({ placeholder: () => placeholderRef.current }),
      SlashCommand.configure({ getBridge: () => bridgeRef.current, getItems: (q) => slashItemsRef.current(q) }),
      NoteLinkPicker.configure({ getBridge: () => bridgeRef.current, getItems: (q) => linkItemsRef.current(q) }),
      ...(activeSession
        ? [
            Collaboration.configure({ document: activeSession.doc, field: NOTES_YJS_FIELD }),
            CollaborationCaret.configure({
              provider: { awareness: activeSession.awareness },
              user: { name: me?.name ?? "", color: peerColor(me?.id) },
              render: renderCaret,
              selectionRender: (user: Record<string, unknown>) => ({
                nodeName: "span",
                class: "collaboration-carets__selection",
                style: `background-color: ${String(user.color ?? "#567FB2")}33`,
              }),
            }),
          ]
        : []),
    ],
    content: null,
    editable: !editingDisabled,
    autofocus: false,
    immediatelyRender: false,
    // TipTap v3 default, stated explicitly: typing does NOT re-render this
    // component; the toolbar subscribes to exactly the state it shows.
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        dir: "auto",
        class:
          "notes-editor max-w-none focus:outline-none h-full min-h-[calc(100dvh-15rem)] text-[var(--text-primary)] text-[15px] md:text-[17px]",
      },
      // In-app note links open the note instead of navigating the page.
      handleClick: (_view, _pos, event) => {
        const a = (event.target as HTMLElement | null)?.closest?.("a");
        const target = a ? parseNoteLink(a.getAttribute("href")) : null;
        if (!target) return false;
        event.preventDefault();
        onOpenNoteRef.current(target);
        return true;
      },
    },
    onUpdate: ({ editor: ed, transaction }) => {
      // Word count is cosmetic — debounce it instead of a render per key.
      if (countTimer.current) clearTimeout(countTimer.current);
      countTimer.current = setTimeout(() => setCounts(countWords(ed.getText())), 300);

      const live = sessionRef.current;
      if (live) {
        // A peer's change arrived over the socket: its author persists it.
        if (isChangeOrigin(transaction) || !live.canWrite) return;
        lastLocalEditAt.current = Date.now();
        queueChange({ body_json: ed.getJSON(), yjs_update: live.encodeState() });
        return;
      }
      lastLocalEditAt.current = Date.now();
      queueChange({ body_json: ed.getJSON() });
    },
  }, [activeSession]);

  useEffect(() => () => { if (countTimer.current) clearTimeout(countTimer.current); }, []);

  // Placeholder follows the UI language.
  useEffect(() => {
    placeholderRef.current = `${t("editor.placeholder")}  ${t("slash.hint")}`;
    if (editor && !editor.isDestroyed) {
      try { editor.view.dispatch(editor.state.tr); } catch { /* not mounted yet */ }
    }
  }, [t, lang, editor]);

  /* ── Realtime collaboration ──────────────────────────────────────────
     A peer's save sends a content-free PING. We then pull the fresh note
     through the AUTHORIZED API (so note text never rides the socket) and
     apply it — unless we have unsaved/in-flight edits of our own, or the
     user is typing in the body or the title. */
  const handleRemote = useCallback(async () => {
    const cur = noteRef.current;
    if (!editor || !cur) return;
    const busy = () => {
      const id = cur.id;
      if (pendingRef.current.has(id) || inflightRef.current.has(id)) return true;
      if (typeof document !== "undefined" && document.activeElement === titleInputRef.current) return true;
      return Date.now() - lastLocalEditAt.current < 2000 && editor.isFocused;
    };
    if (busy()) return;
    const fresh = await fetchNote(cur.id);
    if (!fresh || busy() || noteIdRef.current !== cur.id) return; // re-check after the await
    setTitleDraft(fresh.title ?? "");
    setTagsDraft(fresh.tags ?? []);
    // In a live session the body is the shared Yjs doc — never overwrite it.
    if (!sessionRef.current) {
      try {
        editor.commands.setContent((fresh.body_json ?? EMPTY_DOC) as never, { emitUpdate: false });
        setCounts(countWords(editor.getText()));
      } catch { /* malformed — ignore */ }
    }
    onRemoteApplied(fresh);
  }, [editor, onRemoteApplied]);

  /* A body change landed OUTSIDE the live session (a single-editor save,
     merged into the stored Yjs state by the server): pull the stored state
     and merge it into the live doc. Merging is always safe — our own
     unsaved edits are separate CRDT items — so this never waits for "not
     busy". Coalesced: one pull in flight, at most one queued behind it. */
  const pullingRef = useRef(false);
  const pullAgainRef = useRef(false);
  const pullServerState = useCallback(async () => {
    if (pullingRef.current) { pullAgainRef.current = true; return; }
    pullingRef.current = true;
    try {
      do {
        pullAgainRef.current = false;
        const s = sessionRef.current;
        if (!s) return;
        const j = await fetchCollabJoin(s.noteId);
        if (!j || !j.available || sessionRef.current !== s) return;
        s.setKeys(j.keys);
        s.applyServerState(j.state);
      } while (pullAgainRef.current);
    } finally {
      pullingRef.current = false;
    }
  }, []);

  const onRemoteUpdate = useCallback((u: NoteUpdate) => {
    if (u.body && sessionRef.current) void pullServerState();
    void handleRemote();
  }, [handleRemote, pullServerState]);

  /* The channel came back after a drop: a live session may have missed a
     body ping, so pull the stored state; a client that had fallen back to
     the single-editor path tries to rejoin. */
  const onSubscribed = useCallback((first: boolean) => {
    if (sessionRef.current) { if (!first) void pullServerState(); return; }
    if (fallbackRetryRef.current) setJoinTick((n) => n + 1);
  }, [pullServerState]);

  /* Only a note that is actually shared opens a realtime channel. */
  const { peers, broadcastUpdate } = useNoteCollab({
    noteId: note?.id,
    me,
    status: editingDisabled ? "viewing" : "editing",
    enabled: collabEligible,
    onRemoteUpdate,
    yjs: activeSession,
    onSubscribed,
  });
  useEffect(() => { broadcastRef.current = broadcastUpdate; }, [broadcastUpdate]);

  const retryDelayRef = useRef(JOIN_RETRY_MIN_MS);
  /* Join the live session of a shared note. Pending single-editor edits of
     this note are landed FIRST so the server's seed (or, when a session
     already exists, the stored state they are merged into) contains them;
     if they cannot be saved, the note stays on the single-editor path for
     now. The same sequence REJOINS after a fallback (joinTick): flush the
     local edits through the save pipeline, then join — nothing typed on
     the single-editor path is lost when the editor rebinds to the shared
     doc. While joining the editor is read-only, so nothing slips between
     the flush and the rebind. */
  useEffect(() => {
    if (!collabEligible || !noteId) {
      setSession(null);
      setCollab({ id: noteId, phase: "off" });
      return;
    }
    let cancelled = false;
    setCollab({ id: noteId, phase: "joining" });
    void (async () => {
      await sendNote(noteId);
      if (cancelled) return;
      if (pendingRef.current.has(noteId)) { setCollab({ id: noteId, phase: "off", retry: true }); return; }
      const j = await fetchCollabJoin(noteId);
      if (cancelled) return;
      if (!j) { setCollab({ id: noteId, phase: "off", retry: true }); return; }
      if (!j.available) { setCollab({ id: noteId, phase: "off", retry: false }); return; }
      retryDelayRef.current = JOIN_RETRY_MIN_MS;
      setSession(new NoteYjsSession({ noteId, state: j.state, keys: j.keys, tabId: getTabClientId() }));
      setCollab({ id: noteId, phase: "live" });
    })();
    return () => { cancelled = true; };
  }, [collabEligible, noteId, sendNote, joinTick]);

  /* Fallen back for a transient reason: retry with backoff, and at once
     when the browser comes back online. (A realtime reconnect retries via
     onSubscribed; a 409 on a fallback save retries from sendNote.) */
  useEffect(() => {
    if (!fallbackRetry) return;
    const kick = () => setJoinTick((n) => n + 1);
    const timer = setTimeout(kick, retryDelayRef.current);
    retryDelayRef.current = Math.min(retryDelayRef.current * 2, JOIN_RETRY_MAX_MS);
    window.addEventListener("online", kick);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", kick);
    };
  }, [fallbackRetry, joinTick]);

  /* Leaving a live session for the single-editor path (the note was
     unshared under us): the solo editor starts from our last saved copy,
     so refresh it from the server once the rebuilt editor is up — its base
     token and body then describe the same version. */
  const soloRefreshRef = useRef(false);
  useEffect(() => {
    if (activeSession || !editor || !soloRefreshRef.current) return;
    soloRefreshRef.current = false;
    void handleRemote();
  }, [activeSession, editor, handleRemote]);

  /* One session at a time; a replaced session is torn down (its caret is
     removed for everyone). A peer using a different key (someone was added
     or removed) makes us refetch the keys — throttled; if collaboration is
     no longer available (unshared), fall back to the single-editor path. */
  useEffect(() => {
    if (!session) return;
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    session.onStaleKey = () => {
      if (timer) return;
      timer = setTimeout(async () => {
        timer = null;
        last = Date.now();
        const j = await fetchCollabJoin(session.noteId);
        if (!j) return;
        if (!j.available) {
          soloRefreshRef.current = true;
          setSession((cur) => (cur === session ? null : cur));
          setCollab({ id: session.noteId, phase: "off", retry: false });
          return;
        }
        session.setKeys(j.keys);
        session.applyServerState(j.state);
      }, Math.max(0, last + 10_000 - Date.now()));
    };
    return () => {
      session.onStaleKey = null;
      if (timer) clearTimeout(timer);
      session.destroy();
    };
  }, [session]);

  /* ── Link dialog + image upload handlers ─────────────────────────── */
  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    setLinkInitial((editor.getAttributes("link").href ?? "") as string);
    setLinkOpen(true);
  }, [editor]);

  const applyLink = useCallback(
    (url: string) => {
      if (!editor) return;
      if (!url.trim()) { editor.chain().focus().unsetLink().run(); return; }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
    },
    [editor],
  );

  const triggerImageUpload = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleImageFile = useCallback(
    async (file: File) => {
      const cur = noteRef.current;
      if (!editor || !cur) return;
      setUploading(true);
      try {
        const res = await uploadNoteImage(cur.id, file);
        if (!res.ok) {
          notify(
            t(res.reason === "type" ? "error.imageType" : res.reason === "size" ? "error.imageSize" : "error.imageUpload"),
            "error",
          );
          return;
        }
        // Only insert into the note it was uploaded for.
        if (noteIdRef.current === cur.id) editor.chain().focus().setImage({ src: res.src }).run();
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [editor, notify, t],
  );

  /* ── "/" block menu + "[[" note-link picker items ─────────────────────── */
  const linkSeq = useRef(0);
  const lastLinkItems = useRef<MenuItem[]>([]);
  useEffect(() => {
    const cmd = (fn: (e: Editor, r: { from: number; to: number }) => void) => fn;
    slashItemsRef.current = (query: string) => {
      const all: MenuItem[] = [
        { id: "h1", icon: "h1", label: t("fmt.title"), keywords: "heading title h1", run: cmd((e, r) => { e.chain().focus().deleteRange(r).setNode("heading", { level: 1 }).run(); }) },
        { id: "h2", icon: "h2", label: t("fmt.heading"), keywords: "heading h2", run: cmd((e, r) => { e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run(); }) },
        { id: "h3", icon: "h3", label: t("fmt.subheading"), keywords: "subheading heading h3", run: cmd((e, r) => { e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run(); }) },
        { id: "bullet", icon: "bullet", label: t("fmt.bulletList"), keywords: "bullet list unordered ul", run: cmd((e, r) => { e.chain().focus().deleteRange(r).toggleBulletList().run(); }) },
        { id: "ordered", icon: "ordered", label: t("fmt.numberedList"), keywords: "numbered ordered list ol", run: cmd((e, r) => { e.chain().focus().deleteRange(r).toggleOrderedList().run(); }) },
        { id: "task", icon: "task", label: t("fmt.checklist"), keywords: "checklist todo task check", run: cmd((e, r) => { e.chain().focus().deleteRange(r).toggleTaskList().run(); }) },
        { id: "table", icon: "table", label: t("slash.table"), keywords: "table grid", run: cmd((e, r) => { e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); }) },
        { id: "divider", icon: "divider", label: t("tt.divider"), keywords: "divider rule hr line separator", run: cmd((e, r) => { e.chain().focus().deleteRange(r).setHorizontalRule().run(); }) },
        { id: "quote", icon: "quote", label: t("fmt.quote"), keywords: "quote blockquote", run: cmd((e, r) => { e.chain().focus().deleteRange(r).toggleBlockquote().run(); }) },
        { id: "code", icon: "code", label: t("fmt.codeBlock"), keywords: "code block pre snippet", run: cmd((e, r) => { e.chain().focus().deleteRange(r).toggleCodeBlock().run(); }) },
        { id: "image", icon: "image", label: t("slash.image"), keywords: "image picture photo upload img", run: cmd((e, r) => { e.chain().focus().deleteRange(r).run(); fileInputRef.current?.click(); }) },
      ];
      const q = query.trim().toLowerCase();
      if (!q) return all;
      return all.filter((i) => i.label.toLowerCase().includes(q) || (i.keywords ?? "").includes(q));
    };

    linkItemsRef.current = async (query: string) => {
      const seq = ++linkSeq.current;
      await new Promise((r) => setTimeout(r, 140)); // debounce keystrokes
      if (seq !== linkSeq.current) return lastLinkItems.current;
      const search = query.trim() || undefined;
      let rows: NoteRow[] = [];
      try {
        const [own, shared] = await Promise.all([
          fetchNotes({ smartFolder: "all", search }),
          fetchNotes({ smartFolder: "shared", search }).catch(() => [] as NoteRow[]),
        ]);
        rows = [...own, ...shared];
      } catch { /* offline → empty list */ }
      if (seq !== linkSeq.current) return lastLinkItems.current;
      const self = noteIdRef.current;
      const seen = new Set<string>();
      const items = rows
        .filter((n) => n.id !== self && !seen.has(n.id) && (seen.add(n.id), true))
        .slice(0, 8)
        .map<MenuItem>((n) => {
          const label = n.title?.trim() || t("untitled");
          return {
            id: n.id,
            icon: "note",
            label,
            hint: n.owner_name ? `${t("share.sharedBy")} ${n.owner_name}` : (n.body_plain ?? "").split("\n")[0]?.slice(0, 60),
            run: (e, r) => {
              e.chain().focus().deleteRange(r).insertContent([
                { type: "text", text: label, marks: [{ type: "link", attrs: { href: noteLinkHref(n.id) } }] },
                { type: "text", text: " " },
              ]).run();
            },
          };
        });
      lastLinkItems.current = items;
      return items;
    };
  });

  /* ── Note actions ──────────────────────────────────────────────────────── */

  const exportMarkdown = useCallback(() => {
    const cur = noteRef.current;
    if (!editor || !cur) return;
    const md = noteToMarkdown({
      title: titleDraft,
      tags: tagsDraft,
      body: editor.getJSON(),
      origin: window.location.origin,
    });
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = noteFileName(titleDraft || t("untitled"), "md");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [editor, titleDraft, tagsDraft, t]);

  const printNote = useCallback(() => {
    if (!editor) return;
    const title = titleDraft.trim() || t("untitled");
    const tags = tagsDraft.length ? `<div class="note-tags">${tagsDraft.map((x) => `#${escapeHtml(x)}`).join(" ")}</div>` : "";
    const html =
      `<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8">` +
      `<title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>` +
      `<h1 class="note-title" dir="auto">${escapeHtml(title)}</h1>${tags}<main dir="auto">${editor.getHTML()}</main></body></html>`;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    Object.assign(frame.style, { position: "fixed", width: "0", height: "0", border: "0", insetInlineStart: "-9999px" });
    frame.onload = () => {
      const w = frame.contentWindow;
      if (!w) { frame.remove(); return; }
      w.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 100));
      w.focus();
      w.print();
      // Some browsers never fire afterprint for a frame.
      setTimeout(() => frame.remove(), 60_000);
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  }, [editor, titleDraft, tagsDraft, lang, t]);

  const doSaveVersion = useCallback(async () => {
    const cur = noteRef.current;
    if (!cur) return;
    await sendNote(cur.id); // the snapshot must include what was just typed
    const ok = await saveVersion(cur.id);
    notify(t(ok ? "act.versionSaved" : "history.unavailable"), ok ? "success" : "error");
    if (ok) setHistoryKey((k) => k + 1);
  }, [sendNote, notify, t]);

  const doRestore = useCallback(async () => {
    const v = restoreTarget;
    const cur = noteRef.current;
    if (!v || !cur || !editor || disabledRef.current) return;
    setRestoreBusy(true);
    try {
      await sendNote(cur.id);
      // Snapshot the current content FIRST — a restore is never destructive.
      const ok = await saveVersion(cur.id);
      if (!ok) { notify(t("error.generic"), "error"); return; }
      if (noteIdRef.current !== cur.id) return;
      // Applied through the editor, so in a live session it reaches every
      // collaborator as ordinary edits (and is saved as a merge).
      editor.commands.setContent((v.body_json ?? EMPTY_DOC) as never, { emitUpdate: true });
      setTitleDraft(v.title ?? "");
      queueChange({ title: v.title ?? "", body_json: editor.getJSON() }, true);
      setHistoryKey((k) => k + 1);
      setRestoreTarget(null);
      notify(t("history.restored"), "success");
    } finally {
      setRestoreBusy(false);
    }
  }, [restoreTarget, editor, sendNote, queueChange, notify, t]);

  const insertAi = useCallback((r: Extract<NoteAiResult, { ok: true }>) => {
    if (!editor || disabledRef.current) return;
    const heading = {
      type: "heading",
      attrs: { level: 3 },
      content: [{ type: "text", text: t(r.kind === "summary" ? "ai.summaryHeading" : "ai.actionsHeading") }],
    };
    const body =
      r.kind === "summary"
        ? r.text.split(/\n+/).map((p) => p.trim()).filter(Boolean).map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] }))
        : [{
            type: "taskList",
            content: r.items.map((it) => ({ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: [{ type: "text", text: it }] }] })),
          }];
    editor.chain().insertContentAt(editor.state.doc.content.size, [heading, ...body]).focus("end").run();
    notify(t("ai.inserted"), "success");
  }, [editor, notify, t]);

  const createTodo = useCallback(async () => {
    const cur = noteRef.current;
    if (!editor || !cur || disabledRef.current) return;
    const item = taskItemAtSelection(editor);
    if (!item || item.todoId) return;
    if (!item.text) { notify(t("todo.emptyItem"), "info"); return; }
    setTodoBusy(true);
    const title = titleDraft.trim() || t("untitled");
    const res = await createTodoFromNote({
      title: item.text,
      noteId: cur.id,
      noteTitle: title,
      description: `${t("todo.fromNote")}: ${title}\n${window.location.origin}${noteLinkHref(cur.id)}`,
    });
    setTodoBusy(false);
    if (!res.ok) { notify(t(res.forbidden ? "todo.forbidden" : "error.generic"), "error"); return; }
    notify(t("todo.created"), "success");
    if (noteIdRef.current !== cur.id || editor.isDestroyed) return;
    // Link the item (positions may have moved while the request ran).
    let target = -1;
    const at = editor.state.doc.nodeAt(item.pos);
    if (at?.type.name === "taskItem" && !at.attrs.todoId) target = item.pos;
    else {
      editor.state.doc.descendants((n, pos) => {
        if (target >= 0) return false;
        if (n.type.name === "taskItem" && !n.attrs.todoId && (n.firstChild?.textContent ?? "").trim() === item.text) target = pos;
        return true;
      });
    }
    if (target < 0) return;
    editor.chain().command(({ tr }) => {
      const n = tr.doc.nodeAt(target);
      if (!n) return false;
      tr.setNodeMarkup(target, undefined, { ...n.attrs, todoId: res.id });
      return true;
    }).run();
  }, [editor, titleDraft, notify, t]);

  const openTodo = useCallback((todoId: string) => {
    window.open(`/todo?task=${encodeURIComponent(todoId)}`, "_blank", "noopener");
  }, []);

  /* When a DIFFERENT note is selected (or the parent asks for a reload),
     sync title/tags/body into the editor. Pending edits of the previous note
     are FLUSHED first — never discarded. A reload of the SAME note (after a
     conflict) drops that note's stale pending edits instead. */
  const loadedNoteIdRef = useRef<string | null>(null);
  const loadedVersionRef = useRef(contentVersion);
  const loadKey = note ? `${note.id}:${contentVersion}` : null;
  const hasNote = !!note;
  useEffect(() => {
    // Note closed: send whatever is pending, and forget what was loaded so
    // reopening the same note is treated as a fresh open (flush, not drop).
    if (!hasNote) {
      flushAll();
      loadedNoteIdRef.current = null;
    }
  }, [hasNote, flushAll]);
  useEffect(() => {
    const cur = noteRef.current;
    if (!editor || !cur || !loadKey) return;
    const conflictReload = loadedNoteIdRef.current === cur.id && loadedVersionRef.current !== contentVersion;
    if (conflictReload) pendingRef.current.delete(cur.id);
    flushAll();
    loadedNoteIdRef.current = cur.id;
    loadedVersionRef.current = contentVersion;
    setTitleDraft(cur.title ?? "");
    setTagsDraft(cur.tags ?? []);
    setTagInput("");
    // A live editor renders the shared Yjs doc; only a solo editor loads JSON.
    if (!sessionRef.current || sessionRef.current.noteId !== cur.id) {
      editor.commands.setContent((cur.body_json ?? EMPTY_DOC) as never, { emitUpdate: false });
    }
    setCounts(countWords(editor.getText()));
  }, [editor, loadKey, contentVersion, flushAll]);

  useEffect(() => { editor?.setEditable(!editingDisabled); }, [editor, editingDisabled]);

  /* A rename from the list/dialog: show it, and drop any older pending title
     so the debounce cannot write the previous text back over it. */
  const titleSeq = titleSignal?.seq ?? 0;
  useEffect(() => {
    if (!titleSignal || titleSignal.id !== noteIdRef.current) return;
    const pending = pendingRef.current.get(titleSignal.id);
    if (pending && "title" in pending) {
      const rest = { ...pending };
      delete rest.title;
      if (Object.keys(rest).length) pendingRef.current.set(titleSignal.id, rest);
      else pendingRef.current.delete(titleSignal.id);
    }
    setTitleDraft(titleSignal.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleSeq]);

  /* Tags — saved immediately (not debounced). */
  const commitTags = useCallback((next: string[]) => {
    setTagsDraft(next);
    queueChange({ tags: next }, true);
  }, [queueChange]);
  const addTag = useCallback(() => {
    const v = tagInput.trim().replace(/^#/, "").slice(0, 40);
    if (!v) return;
    if (tagsDraft.some((x) => x.toLowerCase() === v.toLowerCase())) { setTagInput(""); return; }
    commitTags([...tagsDraft, v]);
    setTagInput("");
  }, [tagInput, tagsDraft, commitTags]);

  const folderOptions = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f] as const));
    const pathOf = (f: NotesFolderRow): string => {
      const parts = [f.name];
      const seen = new Set<string>([f.id]);
      let cur: NotesFolderRow | undefined = f;
      // `seen` guards against a parent loop in the data.
      while (cur?.parent_id && !seen.has(cur.parent_id)) {
        const p = byId.get(cur.parent_id);
        if (!p) break;
        seen.add(p.id);
        parts.unshift(p.name);
        cur = p;
      }
      return parts.join(" / ");
    };
    return folders.map((f) => ({ id: f.id, path: pathOf(f) })).sort((a, b) => a.path.localeCompare(b.path));
  }, [folders]);

  const backButton = onBack ? (
    <button
      type="button"
      onClick={() => { flushAll(); onBack(); }}
      aria-label={t("back")}
      className="md:hidden h-8 px-2 rounded-lg flex items-center gap-1 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
    >
      <ArrowLeftIcon className="h-3.5 w-3.5 rtl:-scale-x-100" />
      {t("back")}
    </button>
  ) : null;

  // Empty state
  if (!note) {
    return (
      <div className="h-full min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-faint)]">
          <NotesIcon size={24} />
        </div>
        <div className="text-[13px] text-[var(--text-muted)]">{t("selectOne")}</div>
      </div>
    );
  }

  const surface = resolveSurface(note.color);
  const activeSurfaceKey = note.color ?? "default";
  // On a light paper page, flip title/tag ink to dark so it stays readable.
  const inkClass = surface.light ? "text-[#1c1c1c]" : "text-[var(--text-primary)]";
  const ghostClass = surface.light ? "placeholder:text-[#9a9a9a]" : "placeholder:text-[var(--text-ghost)]";
  const linkClass = surface.light
    ? "[&_a]:text-[#2F5C8A]!"
    : "[&_a]:text-[#567FB2]! dark:[&_a]:text-[#7FA9D6]!";
  const ownerControls = !editingDisabled && !isSharee; // owner-only chrome

  const collabLive = !!activeSession;
  const menuItemCls =
    "w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-start text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] focus-visible:bg-[var(--bg-surface)] focus-visible:text-[var(--text-primary)] outline-none disabled:opacity-40";
  const closeMore = (refocus = true) => {
    setMoreOpen(false);
    if (refocus) moreBtnRef.current?.focus();
  };
  const moreAction = (fn: () => void) => () => { closeMore(false); fn(); };

  return (
    <div className="relative h-full flex flex-col">
      {/* Toolbar — tools live inside a bordered "shell" panel */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-3 md:px-5 py-2.5 flex items-center gap-2 flex-wrap">
        {backButton}
        <div className="flex items-center gap-1.5 flex-wrap rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-1.5 py-1">
          <EditorToolbar
            editor={editor}
            t={t}
            readOnly={editingDisabled}
            onOpenLink={openLinkDialog}
            onUploadImage={triggerImageUpload}
            uploading={uploading}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={NOTES_IMAGE_MIME.join(",")}
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageFile(f); }}
        />

        <div className="flex-1" />

        <span className="hidden sm:inline text-[10.5px] font-medium text-[var(--text-dim)] tabular-nums me-1">
          {counts.words} {t(counts.words === 1 ? "count.word" : "count.words")}
        </span>

        <SaveIndicator saving={saving} t={t} onRetry={() => flushAll()} />
      </div>

      {/* Meta row — collaborators · colour · share · folder · pin · delete */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-3 md:px-5 py-2 flex items-center gap-2 flex-wrap">
        {isViewer && (
          <span className="text-[10.5px] font-semibold px-2 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">{t("share.viewOnly")}</span>
        )}
        {note.owner_name && isSharee && (
          <span className="text-[11px] text-[var(--text-dim)]">{t("share.sharedBy")} {note.owner_name}</span>
        )}

        {collabLive ? (
          <span
            title={t("collab.liveTip")}
            className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full border border-emerald-600/30 bg-emerald-500/10 text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-300"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
            {t("collab.live")}
            <span className="sr-only">— {t("collab.liveTip")}</span>
          </span>
        ) : collabPending ? (
          <span role="status" className="inline-flex items-center gap-1.5 h-6 px-2 text-[10.5px] text-[var(--text-dim)]">
            <SpinnerIcon className="h-3 w-3" /> {t("collab.connecting")}
          </span>
        ) : null}

        {peers.length > 0 && (
          <div className="flex items-center -space-x-1.5 rtl:space-x-reverse" title={peers.map((p) => `${p.name ?? t("someone")} (${p.status})`).join(", ")}>
            {peers.slice(0, 4).map((p) => {
              const name = p.name ?? t("someone");
              const initials = name.split(/\s+/).map((x) => x[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
              // Same colour as the person's caret in the text.
              const editing = p.status === "editing";
              return (
                <span
                  key={p.id}
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-[var(--bg-primary)] ${editing ? "text-white" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}
                  style={editing ? { backgroundColor: peerColor(p.accountId) } : undefined}
                >
                  {initials || "?"}
                </span>
              );
            })}
            {peers.length > 4 && (
              <span className="h-6 w-6 rounded-full bg-[var(--bg-surface)] border-2 border-[var(--bg-primary)] flex items-center justify-center text-[9px] font-bold text-[var(--text-dim)]">+{peers.length - 4}</span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Note style — colour tints + realistic paper styles (anyone who can edit) */}
        {!editingDisabled && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setColorOpen((v) => !v)}
              title={t("share.noteStyle")}
              aria-label={t("share.noteStyle")}
              aria-expanded={colorOpen}
              aria-haspopup="true"
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all"
            >
              <span className={`h-3.5 w-3.5 rounded-[5px] border border-[var(--border-color)] ${surface.tintClass ?? ""}`} style={surface.swatch} />
            </button>
            {colorOpen && (
              <>
                <div className="fixed inset-0 z-[55]" onClick={() => setColorOpen(false)} />
                <div
                  className="absolute end-0 mt-1 z-[56] w-[208px] p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl space-y-2.5"
                  onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setColorOpen(false); } }}
                >
                  <SurfaceGroup
                    title={t("share.styleColour")}
                    items={NOTE_SURFACES.slice(0, 7)}
                    activeKey={activeSurfaceKey}
                    t={t}
                    onPick={(key) => { queueChange({ color: key === "default" ? null : key }, true); setColorOpen(false); }}
                  />
                  <SurfaceGroup
                    title={t("share.stylePaper")}
                    items={NOTE_SURFACES.slice(7)}
                    activeKey={activeSurfaceKey}
                    t={t}
                    onPick={(key) => { queueChange({ color: key === "default" ? null : key }, true); setColorOpen(false); }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Koleex AI */}
        {!isTrashed && (
          <button
            type="button"
            onClick={() => setPanel((p) => (p === "ai" ? null : "ai"))}
            title={t("act.ai")}
            aria-label={t("act.ai")}
            aria-pressed={panel === "ai"}
            className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 border transition-all text-[11.5px] font-semibold ${panel === "ai" ? "bg-[#567FB2]/15 border-[#567FB2]/30 text-[#567FB2] dark:text-[#7FA9D6]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{t("act.ai")}</span>
          </button>
        )}

        {/* More — history, versions, duplicate, export, print, Discuss */}
        <div className="relative">
          <button
            ref={moreBtnRef}
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            title={t("more.title")}
            aria-label={t("more.title")}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all"
          >
            <MoreHorizontalIcon className="h-3.5 w-3.5" />
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-[55]" onClick={() => closeMore(false)} />
              <div
                role="menu"
                aria-label={t("more.title")}
                ref={moreMenuRef}
                onKeyDown={(e) => {
                  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])"));
                  const i = items.indexOf(document.activeElement as HTMLElement);
                  if (e.key === "Escape") { e.stopPropagation(); closeMore(); }
                  else if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
                  else if (e.key === "Home") { e.preventDefault(); items[0]?.focus(); }
                  else if (e.key === "End") { e.preventDefault(); items[items.length - 1]?.focus(); }
                  else if (e.key === "Tab") closeMore(false);
                }}
                className="kx-glass-pop absolute end-0 mt-1 z-[56] w-[232px] p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl"
              >
                <button type="button" role="menuitem" className={menuItemCls} onClick={moreAction(() => setPanel("history"))}>
                  <HistoryIcon className="h-3.5 w-3.5" /> {t("act.history")}
                </button>
                {!editingDisabled && (
                  <button type="button" role="menuitem" className={menuItemCls} onClick={moreAction(() => { void doSaveVersion(); })}>
                    <BookmarkIcon className="h-3.5 w-3.5" /> {t("act.saveVersion")}
                  </button>
                )}
                {!isTrashed && (
                  <button type="button" role="menuitem" className={menuItemCls} onClick={moreAction(() => { flushAll(); onDuplicate(); })}>
                    <CopyIcon className="h-3.5 w-3.5" /> {t("act.duplicate")}
                  </button>
                )}
                <div role="separator" className="my-1 h-px bg-[var(--border-subtle)]" />
                <button type="button" role="menuitem" className={menuItemCls} onClick={moreAction(exportMarkdown)}>
                  <DownloadIcon className="h-3.5 w-3.5" /> {t("act.exportMd")}
                </button>
                <button type="button" role="menuitem" className={menuItemCls} onClick={moreAction(printNote)}>
                  <PrintIcon className="h-3.5 w-3.5" /> {t("act.print")}
                </button>
                {!isTrashed && (
                  <button type="button" role="menuitem" className={menuItemCls} onClick={moreAction(() => setDiscussOpen(true))}>
                    <PaperPlaneIcon className="h-3.5 w-3.5 rtl:-scale-x-100" /> {t("act.sendDiscuss")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Share */}
        {!isTrashed && (
          <button
            type="button"
            onClick={onShare}
            title={t("share.title")}
            aria-label={t("share.title")}
            className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-[11.5px] font-semibold"
          >
            <Share2Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t("share.button")}</span>
          </button>
        )}

        {/* Owner-only chrome */}
        {ownerControls && (
          <select
            value={note.folder_id ?? ""}
            onChange={(e) => onMove(e.target.value || null)}
            aria-label={t("tt.moveToFolder")}
            title={t("tt.moveToFolder")}
            className="h-8 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] max-w-[40vw] md:max-w-none"
          >
            <option value="">{t("smart.none")}</option>
            {folderOptions.map((f) => (<option key={f.id} value={f.id}>{f.path}</option>))}
          </select>
        )}

        {!isTrashed ? (
          ownerControls && (
            <>
              <button
                type="button"
                onClick={onTogglePin}
                title={note.is_pinned ? t("unpin") : t("pin")}
                aria-label={note.is_pinned ? t("unpin") : t("pin")}
                aria-pressed={note.is_pinned}
                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${note.is_pinned ? "bg-[#567FB2]/15 border-[#567FB2]/30 text-[#567FB2] dark:text-[#7FA9D6]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}
              >
                <PinIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                title={t("moveToTrash")}
                aria-label={t("moveToTrash")}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-red-700 dark:hover:text-red-400 transition-all"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )
        ) : (
          !isSharee && (
            <>
              <button type="button" onClick={onRestore} className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/25 transition-all">{t("restore")}</button>
              <button type="button" onClick={onPurge} className="h-8 px-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-700 dark:text-red-400 text-[11px] font-semibold hover:bg-red-500/25 transition-all">{t("deleteForever")}</button>
            </>
          )
        )}
      </div>

      {/* Title + tags + body — scrollable area. The chosen surface (colour
          tint or realistic paper) washes the actual writing area. Light paper
          flips the ink dark via `notes-surface-light`. */}
      <div
        className={`flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-6 transition-colors duration-300 ${surface.tintClass ?? ""} ${surface.light ? "notes-surface-light" : ""} ${surface.ruled ? "notes-surface-ruled" : ""}`}
        style={surface.ruled ? { ...surface.surface, ["--note-rule" as string]: surface.ruleColor } : surface.surface}
      >
        <input
          ref={titleInputRef}
          type="text"
          dir="auto"
          value={titleDraft}
          disabled={editingDisabled}
          placeholder={t("untitled")}
          aria-label={t("noteName")}
          maxLength={500}
          onChange={(e) => { setTitleDraft(e.target.value); lastLocalEditAt.current = Date.now(); queueChange({ title: e.target.value }); }}
          className={`w-full bg-transparent text-[24px] md:text-[28px] font-bold ${inkClass} ${ghostClass} outline-none mb-2 disabled:cursor-not-allowed`}
        />

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {tagsDraft.map((tag) => (
            <span key={tag} dir="auto" className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
              #{tag}
              {!editingDisabled && (
                <button
                  type="button"
                  onClick={() => commitTags(tagsDraft.filter((x) => x !== tag))}
                  aria-label={`${t("tags.remove")} ${tag}`}
                  className="text-[var(--text-dim)] hover:text-red-700 dark:hover:text-red-400"
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {!editingDisabled && (
            <input
              type="text"
              dir="auto"
              value={tagInput}
              maxLength={40}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } if (e.key === "Backspace" && !tagInput && tagsDraft.length) commitTags(tagsDraft.slice(0, -1)); }}
              onBlur={addTag}
              placeholder={tagsDraft.length ? t("tags.add") : t("tags.addMany")}
              aria-label={t("tags.add")}
              className={`h-6 min-w-[80px] bg-transparent text-[11px] ${inkClass} ${surface.light ? "placeholder:text-[#8a8a8a]" : "placeholder:text-[var(--text-dim)]"} outline-none`}
            />
          )}
        </div>

        <div className={`${linkClass} ${mobileBar ? "notes-mobilebar-open" : ""}`}>
          <EditorContent editor={editor} />
        </div>

        {!isTrashed && <Backlinks noteId={note.id} refreshKey={historyKey} onOpen={onOpenNote} t={t} />}
      </div>

      {/* Floating table controls — appear anchored to the table you're editing */}
      <TableFloatingControls editor={editor} enabled={!editingDisabled} t={t} />

      {/* Checklist item → To-do */}
      <ChecklistTodoControl
        editor={editor}
        canCreate={!editingDisabled}
        busy={todoBusy}
        onCreate={() => { void createTodo(); }}
        onOpen={openTodo}
        t={t}
      />

      {/* "/" and "[[" menus */}
      <SuggestionMenu
        menu={menu}
        title={menu?.kind === "link" ? t("linkPicker.title") : t("slash.title")}
        emptyLabel={menu?.kind === "link" ? t("linkPicker.empty") : t("slash.empty")}
        onChoose={chooseMenu}
        onHover={hoverMenu}
        renderIcon={renderMenuIcon}
      />

      {/* Phones: formatting bar above the keyboard */}
      <MobileFormatBar
        editor={editor}
        enabled={!editingDisabled}
        onImage={triggerImageUpload}
        onVisibleChange={setMobileBar}
        t={t}
      />

      {/* Side panels */}
      {panel === "history" && (
        <HistoryPanel
          key={note.id}
          noteId={note.id}
          canRestore={!editingDisabled}
          onRestore={(v) => setRestoreTarget(v)}
          onClose={() => setPanel(null)}
          refreshKey={historyKey}
          t={t}
        />
      )}
      {panel === "ai" && (
        <AiPanel
          key={note.id}
          noteId={note.id}
          canInsert={!editingDisabled}
          onInsert={insertAi}
          onClose={() => setPanel(null)}
          t={t}
        />
      )}

      <ConfirmDialog
        open={!!restoreTarget}
        busy={restoreBusy}
        title={t("history.restoreTitle")}
        message={t("history.restoreDesc")}
        confirmLabel={t("history.restore")}
        cancelLabel={t("dialog.cancel")}
        onConfirm={() => { void doRestore(); }}
        onCancel={() => { if (!restoreBusy) setRestoreTarget(null); }}
      />

      <SendToDiscussDialog
        open={discussOpen}
        note={{ id: note.id, title: titleDraft }}
        meId={me?.id ?? null}
        onClose={() => setDiscussOpen(false)}
        notify={notify}
        t={t}
      />

      {/* Link prompt */}
      <PromptDialog
        open={linkOpen}
        title={t("fmt.link")}
        label={t("link.url")}
        placeholder="https://example.com"
        initialValue={linkInitial}
        confirmLabel={t("link.apply")}
        onConfirm={(url) => applyLink(url)}
        onClose={() => setLinkOpen(false)}
      />
    </div>
  );
}

/** Icons for the "/" and "[[" menu rows. */
function renderMenuIcon(item: MenuItem): ReactNode {
  const c = "h-3.5 w-3.5";
  switch (item.icon) {
    case "h1": return <Heading1Icon className={c} />;
    case "h2": return <Heading2Icon className={c} />;
    case "h3": return <Heading3Icon className={c} />;
    case "bullet": return <ListIcon className={c} />;
    case "ordered": return <ListOrderedIcon className={c} />;
    case "task": return <CheckSquareIcon className={c} />;
    case "table": return <TableIcon className={c} />;
    case "divider": return <MinusIcon className={c} />;
    case "quote": return <QuoteIcon className={c} />;
    case "code": return <FileCode2Icon className={c} />;
    case "image": return <ImageRawIcon className={c} />;
    default: return <FileIcon className={c} />;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SaveIndicator — Saving… / Saved / Not saved + Retry.
   ═══════════════════════════════════════════════════════════════════════════ */
function SaveIndicator({ saving, t, onRetry }: { saving: SaveState; t: T; onRetry: () => void }) {
  if (saving === "error") {
    return (
      <span role="status" className="text-[10.5px] font-medium flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-600 dark:bg-red-400" />
        <span className="text-red-700 dark:text-red-400">{t("saveError")}</span>
        <button
          type="button"
          onClick={onRetry}
          className="h-6 px-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
        >
          {t("retry")}
        </button>
      </span>
    );
  }
  return (
    <span
      role="status"
      aria-live="polite"
      className={`text-[10.5px] font-medium tabular-nums flex items-center gap-1.5 transition-opacity duration-300 ${saving === "idle" ? "opacity-0" : "opacity-100"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${saving === "saving" ? "bg-[#567FB2] animate-pulse" : saving === "saved" ? "bg-emerald-600 dark:bg-emerald-400" : "bg-transparent"}`} />
      <span className="text-[var(--text-dim)]">{saving === "saving" ? t("saving") : saving === "saved" ? t("saved") : ""}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SurfaceGroup — one labelled row of note-style swatches in the picker.
   ═══════════════════════════════════════════════════════════════════════════ */
function SurfaceGroup({
  title,
  items,
  activeKey,
  onPick,
  t,
}: {
  title: string;
  items: NoteSurface[];
  activeKey: string;
  onPick: (key: string) => void;
  t: T;
}) {
  return (
    <div role="group" aria-label={title}>
      <div className="px-0.5 mb-1.5 text-[9.5px] uppercase tracking-[1.2px] font-semibold text-[var(--text-dim)]">
        {title}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {items.map((s) => (
          <button
            type="button"
            key={s.key}
            title={t(s.labelKey)}
            aria-label={t(s.labelKey)}
            aria-pressed={activeKey === s.key}
            onClick={() => onPick(s.key)}
            className={`h-6 w-6 rounded-md border transition-all hover:scale-110 ${s.tintClass ?? ""} ${
              activeKey === s.key
                ? "ring-2 ring-[#567FB2] ring-offset-1 ring-offset-[var(--bg-secondary)] border-transparent"
                : "border-[var(--border-color)]"
            }`}
            style={s.swatch}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TableFloatingControls — a small contextual bar that floats just above the
   table you're editing (Notion-style). Add/remove rows + columns, toggle the
   header row, delete the table. Only visible when the caret is inside a table.
   ═══════════════════════════════════════════════════════════════════════════ */

// onMouseDown + preventDefault keeps the table selection so the command lands.
function TableBtn({ title, onRun, children, danger }: { title: string; onRun: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => { e.preventDefault(); onRun(); }}
      className={`h-7 min-w-[28px] px-2 rounded-md text-[11px] font-semibold flex items-center justify-center transition-colors ${danger ? "text-[var(--text-dim)] hover:text-red-700 dark:hover:text-red-400 hover:bg-[var(--bg-surface)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"}`}
    >
      {children}
    </button>
  );
}

function TableSep() {
  return <span className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />;
}

function TableFloatingControls({ editor, enabled, t }: { editor: Editor | null; enabled: boolean; t: T }) {
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!editor || !enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hide when disabled
      setBox(null);
      return;
    }
    const update = () => {
      // Only while the editor itself is focused — otherwise the bar would
      // float over modals/popovers (Share dialog, link prompt, etc.).
      if (!editor.isFocused || !editor.isActive("table")) { setBox(null); return; }
      const { from } = editor.state.selection;
      let node: Node | null = null;
      try { node = editor.view.domAtPos(from).node; } catch { setBox(null); return; }
      const el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
      const table = el?.closest("table") as HTMLElement | null;
      if (!table) { setBox(null); return; }
      const r = table.getBoundingClientRect();
      // Place the bar above the table; if too close to the top, place it just inside.
      const top = r.top < 96 ? r.top + 6 : r.top - 40;
      setBox((prev) => (prev && prev.top === top && prev.left === r.left ? prev : { top, left: r.left }));
    };
    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    editor.on("focus", update);
    editor.on("blur", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      editor.off("focus", update);
      editor.off("blur", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editor, enabled]);

  if (!editor || !box) return null;

  return createPortal(
    <div
      style={{ position: "fixed", top: box.top, left: box.left, zIndex: 60 }}
      role="toolbar"
      aria-label={t("tt.table")}
      className="flex items-center gap-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl px-1 py-0.5"
    >
      <TableBtn title={t("table.addRow")} onRun={() => editor.chain().focus().addRowAfter().run()}>{t("table.rowPlus")}</TableBtn>
      <TableBtn title={t("table.delRow")} onRun={() => editor.chain().focus().deleteRow().run()}>{t("table.rowMinus")}</TableBtn>
      <TableSep />
      <TableBtn title={t("table.addCol")} onRun={() => editor.chain().focus().addColumnAfter().run()}>{t("table.colPlus")}</TableBtn>
      <TableBtn title={t("table.delCol")} onRun={() => editor.chain().focus().deleteColumn().run()}>{t("table.colMinus")}</TableBtn>
      <TableSep />
      <TableBtn title={t("table.toggleHeader")} onRun={() => editor.chain().focus().toggleHeaderRow().run()}>{t("table.headerShort")}</TableBtn>
      <TableBtn title={t("table.delete")} danger onRun={() => editor.chain().focus().deleteTable().run()}>
        <TrashIcon className="h-3.5 w-3.5" />
      </TableBtn>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Toolbar — grouped: text style · colour · align · lists · insert · history.
   The building blocks live at module scope (a component defined inside a
   render is a NEW type every render, which remounts its subtree), and the
   toolbar subscribes to editor state via useEditorState so only it
   re-renders on selection/format changes.
   ═══════════════════════════════════════════════════════════════════════════ */

function TB({ active, onClick, title, disabled, children }: { active?: boolean; onClick: () => void; title: string; disabled: boolean; children: ReactNode }) {
  return (
    <span className="relative inline-flex group/tt">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={title}
        aria-pressed={active === undefined ? undefined : active}
        className={`h-8 min-w-[32px] px-2 rounded-lg text-[12px] font-semibold flex items-center justify-center transition-all border ${active ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "bg-transparent border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {children}
      </button>
      {/* Branded tooltip — below the button so it never collides with the
          page header above; fades in after ~0.5s of hover (delay on enter). */}
      <span aria-hidden className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 z-[70] whitespace-nowrap rounded-md bg-[var(--bg-inverted)] px-2 py-1 text-[10.5px] font-medium text-[var(--text-inverted)] shadow-lg opacity-0 transition-opacity duration-150 [transition-delay:0ms] group-hover/tt:opacity-100 group-hover/tt:[transition-delay:500ms]">
        {title}
      </span>
    </span>
  );
}

// Each group is a discrete rounded "segment" so clusters stay readable even
// when the toolbar wraps to a second row.
function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5 rounded-lg bg-[var(--bg-surface)]/70 px-1 py-0.5">{children}</div>;
}

function EditorToolbar({
  editor,
  t,
  readOnly,
  onOpenLink,
  onUploadImage,
  uploading,
}: {
  editor: Editor | null;
  t: T;
  readOnly: boolean;
  onOpenLink: () => void;
  onUploadImage: () => void;
  uploading: boolean;
}) {
  const [textColorOpen, setTextColorOpen] = useState(false);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            block: e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p",
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            strike: e.isActive("strike"),
            highlight: e.isActive("highlight"),
            textStyle: e.isActive("textStyle"),
            left: e.isActive({ textAlign: "left" }),
            center: e.isActive({ textAlign: "center" }),
            right: e.isActive({ textAlign: "right" }),
            bullet: e.isActive("bulletList"),
            ordered: e.isActive("orderedList"),
            task: e.isActive("taskList"),
            quote: e.isActive("blockquote"),
            code: e.isActive("code"),
            codeBlock: e.isActive("codeBlock"),
            link: e.isActive("link"),
            table: e.isActive("table"),
          }
        : null,
  });
  if (!editor || !s) return null;
  const d = readOnly;

  return (
    <>
      {/* Block type */}
      <Group>
        <select
          disabled={readOnly}
          value={s.block}
          aria-label={t("tt.blockType")}
          onChange={(e) => { const v = e.target.value; if (v === "p") editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run(); }}
          className="h-8 px-2 rounded-md bg-transparent border-none text-[12px] text-[var(--text-primary)] outline-none cursor-pointer"
        >
          <option value="p">{t("fmt.body")}</option>
          <option value="h1">{t("fmt.title")}</option>
          <option value="h2">{t("fmt.heading")}</option>
          <option value="h3">{t("fmt.subheading")}</option>
        </select>
      </Group>

      {/* Inline marks + colour */}
      <Group>
        <TB disabled={d} active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()} title={t("fmt.bold")}><BoldIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()} title={t("fmt.italic")}><ItalicIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()} title={t("fmt.underline")}><UnderlineIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()} title={t("fmt.strike")}><StrikethroughIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()} title={t("fmt.highlight")}><HighlighterIcon className="h-3.5 w-3.5" /></TB>
        <div className="relative">
          <TB disabled={d} active={s.textStyle} onClick={() => setTextColorOpen((v) => !v)} title={t("tt.textColour")}>
            <span className="flex flex-col items-center justify-center leading-none">
              <span className="text-[11px] font-bold">A</span>
              <span className="h-[2px] w-3.5 rounded mt-0.5 bg-[#567FB2]" />
            </span>
          </TB>
          {textColorOpen && (
            <>
              <div className="fixed inset-0 z-[55]" onClick={() => setTextColorOpen(false)} />
              <div
                className="absolute start-0 mt-1 z-[56] p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl flex gap-1.5 items-center"
                onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setTextColorOpen(false); } }}
              >
                {TEXT_COLORS.map((c) => (
                  <button type="button" key={c} title={c} aria-label={c} onClick={() => { editor.chain().focus().setColor(c).run(); setTextColorOpen(false); }} className="h-5 w-5 rounded-full border border-[var(--border-color)]" style={{ background: c }} />
                ))}
                <button type="button" title={t("color.default")} onClick={() => { editor.chain().focus().unsetColor().run(); setTextColorOpen(false); }} className="h-5 px-2 rounded-md text-[10px] font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">{t("color.reset")}</button>
              </div>
            </>
          )}
        </div>
      </Group>

      {/* Align */}
      <Group>
        <TB disabled={d} active={s.left} onClick={() => editor.chain().focus().setTextAlign("left").run()} title={t("tt.alignLeft")}><AlignLeftIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.center} onClick={() => editor.chain().focus().setTextAlign("center").run()} title={t("tt.alignCenter")}><AlignCenterIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.right} onClick={() => editor.chain().focus().setTextAlign("right").run()} title={t("tt.alignRight")}><AlignRightIcon className="h-3.5 w-3.5" /></TB>
      </Group>

      {/* Lists */}
      <Group>
        <TB disabled={d} active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} title={t("fmt.bulletList")}><ListIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()} title={t("fmt.numberedList")}><ListOrderedIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.task} onClick={() => editor.chain().focus().toggleTaskList().run()} title={t("fmt.checklist")}><CheckSquareIcon className="h-3.5 w-3.5" /></TB>
      </Group>

      {/* Insert */}
      <Group>
        <TB disabled={d} active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} title={t("fmt.quote")}><QuoteIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.code} onClick={() => editor.chain().focus().toggleCode().run()} title={t("fmt.code")}><CodeIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title={t("fmt.codeBlock")}><FileCode2Icon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.link} onClick={onOpenLink} title={t("fmt.link")}><LinkIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d || uploading} onClick={onUploadImage} title={t("tt.image")}>
          {uploading ? <SpinnerIcon className="h-3.5 w-3.5" /> : <ImageRawIcon className="h-3.5 w-3.5" />}
        </TB>
        <TB disabled={d} onClick={() => editor.chain().focus().setHorizontalRule().run()} title={t("tt.divider")}><MinusIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} active={s.table} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title={t("tt.table")}><TableIcon className="h-3.5 w-3.5" /></TB>
      </Group>

      {/* Clear + history */}
      <Group>
        <TB disabled={d} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title={t("tt.clear")}><RemoveFormattingIcon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} onClick={() => editor.chain().focus().undo().run()} title={t("fmt.undo")}><Undo2Icon className="h-3.5 w-3.5" /></TB>
        <TB disabled={d} onClick={() => editor.chain().focus().redo().run()} title={t("fmt.redo")}><Redo2Icon className="h-3.5 w-3.5" /></TB>
      </Group>
    </>
  );
}
