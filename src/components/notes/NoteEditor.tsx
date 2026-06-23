"use client";

/* ---------------------------------------------------------------------------
   NoteEditor — right pane. TipTap-based rich text editor with:
     • Title input + tags + note colour
     • A grouped formatting toolbar (text style, colour, alignment, lists,
       insert: link/image/table/divider, history)
     • Auto-save (500ms debounce) with a "Saving…/Saved" indicator
     • Sharing: a Share button + live collaborator presence (avatars)
     • Realtime collaboration on shared notes — peers' edits apply live
     • Move-to-folder, Pin, Delete; read-only for trash + view-only sharees
   --------------------------------------------------------------------------- */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";

import { useTranslation } from "@/lib/i18n";
import { notesT } from "@/lib/translations/notes";
import { fetchNote, type NoteFull, type NotesFolderRow } from "@/lib/notes";
import { useNoteCollab } from "@/lib/note-collab";
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
import { PromptDialog } from "./NotesDialog";

/* ---------------------------------------------------------------------------
   Note surfaces — the value stored in `notes.color`. Two families:
     • Colour tints (muted dark washes, on-brand, dark ink stays white)
     • Paper styles (realistic light pages — ruled / grid / dots / legal pad).
       Light pages flip the ink to dark via the `notes-surface-light` class.
   No DB change: everything is encoded in the existing `color` text column.
   --------------------------------------------------------------------------- */
type NoteSurface = {
  key: string;                 // stored value ("default" → null)
  label: string;
  light?: boolean;             // light page → dark ink
  surface: CSSProperties;      // applied to the writing area
  swatch: CSSProperties;       // mini preview in the picker
};

const RULE = "#c2d2ee";        // notebook rule colour
const GRID = "#e1e1e1";        // grid line colour
const DOT = "#cdcdcd";         // dot colour
const PAD = "#fbf5c9";         // legal-pad paper
const PAD_RULE = "#d9c987";    // legal-pad rule

const NOTE_SURFACES: NoteSurface[] = [
  { key: "default", label: "Default", surface: {}, swatch: { background: "var(--bg-surface)" } },
  // Colour tints (dark washes)
  { key: "#3a3a3a", label: "Gray",   surface: { background: "#3a3a3a" }, swatch: { background: "#3a3a3a" } },
  { key: "#16324f", label: "Blue",   surface: { background: "#16324f" }, swatch: { background: "#16324f" } },
  { key: "#173a2b", label: "Green",  surface: { background: "#173a2b" }, swatch: { background: "#173a2b" } },
  { key: "#3d3014", label: "Amber",  surface: { background: "#3d3014" }, swatch: { background: "#3d3014" } },
  { key: "#3d1c1c", label: "Red",    surface: { background: "#3d1c1c" }, swatch: { background: "#3d1c1c" } },
  { key: "#2c1f3d", label: "Purple", surface: { background: "#2c1f3d" }, swatch: { background: "#2c1f3d" } },
  // Paper styles (light pages)
  {
    key: "paper-lined", label: "Ruled paper", light: true,
    surface: {
      backgroundColor: "#ffffff",
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 30px, ${RULE} 31px)`,
    },
    swatch: {
      backgroundColor: "#ffffff",
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 3px, ${RULE} 4px)`,
    },
  },
  {
    key: "paper-grid", label: "Grid paper", light: true,
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
    key: "paper-dots", label: "Dotted paper", light: true,
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
    key: "pad-yellow", label: "Legal pad", light: true,
    surface: {
      backgroundColor: PAD,
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 30px, ${PAD_RULE} 31px)`,
    },
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
  return { key: value, label: "Colour", surface: { background: value }, swatch: { background: value } };
}

/* Inline font colours for the text-colour picker. */
const TEXT_COLORS = ["#0066FF", "#E5484D", "#0FA968", "#E8A33D", "#9B7BE0", "#888888", "#FFFFFF"];

type EditorChange = {
  title?: string;
  body_json?: unknown;
  color?: string | null;
  tags?: string[];
};

export default function NoteEditor({
  note,
  folders,
  readOnly,
  saving,
  me,
  peersExternal,
  onChange,
  onMove,
  onTogglePin,
  onDelete,
  onRestore,
  onPurge,
  onShare,
}: {
  note: NoteFull | null;
  folders: NotesFolderRow[];
  readOnly: boolean;
  saving: "idle" | "saving" | "saved";
  me: { id: string; name: string } | null;
  /** Lets the parent surface presence elsewhere; optional. */
  peersExternal?: (count: number) => void;
  onChange: (updates: EditorChange) => void;
  onMove: (folderId: string | null) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onPurge: () => void;
  onShare: () => void;
}) {
  const { t } = useTranslation(notesT);
  const [titleDraft, setTitleDraft] = useState(note?.title ?? "");
  const [tagsDraft, setTagsDraft] = useState<string[]>(note?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [counts, setCounts] = useState<{ words: number; chars: number }>({ words: 0, chars: 0 });
  const [colorOpen, setColorOpen] = useState(false);

  /* Link prompt + image upload state for the toolbar. */
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInitial, setLinkInitial] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const isTrashed = note?.deleted_at != null;
  const isViewer = note?.role === "viewer";
  const isSharee = note?.role === "viewer" || note?.role === "editor";
  const editingDisabled = readOnly || isTrashed || isViewer;

  const lastLocalEditAt = useRef(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, underline: false }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "notes-image" } }),
    ],
    content: null,
    editable: !editingDisabled,
    autofocus: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "notes-editor prose prose-invert prose-sm md:prose-lg max-w-none focus:outline-none h-full min-h-[calc(100dvh-15rem)] text-[var(--text-primary)]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      lastLocalEditAt.current = Date.now();
      const json = ed.getJSON();
      const text = ed.getText();
      setCounts({
        words: text.trim() ? text.trim().split(/\s+/).length : 0,
        chars: text.length,
      });
      scheduleSaveRef.current?.({ body_json: json });
    },
  });

  // Debounced auto-save ────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<EditorChange>({});

  const scheduleSave = useCallback(
    (next: EditorChange) => {
      if (editingDisabled) return;
      pendingRef.current = { ...pendingRef.current, ...next };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const payload = pendingRef.current;
        pendingRef.current = {};
        onChange(payload);
        broadcastRef.current?.();
      }, 500);
    },
    [onChange, editingDisabled],
  );

  const scheduleSaveRef = useRef(scheduleSave);
  useEffect(() => { scheduleSaveRef.current = scheduleSave; }, [scheduleSave]);

  /* ── Realtime collaboration ──────────────────────────────────────────
     A peer's save sends a content-free PING. We then pull the fresh note
     through the AUTHORIZED API (so note text never rides the anon socket)
     and apply it — unless the user is actively typing. */
  const handleRemote = useCallback(async () => {
    if (!editor || !note) return;
    const busyTyping = () => Date.now() - lastLocalEditAt.current < 2000 && editor.isFocused;
    if (busyTyping()) return;
    const fresh = await fetchNote(note.id);
    if (!fresh || busyTyping()) return; // re-check after the await
    setTitleDraft(fresh.title ?? "");
    setTagsDraft(fresh.tags ?? []);
    try {
      editor.commands.setContent(
        (fresh.body_json ?? { type: "doc", content: [{ type: "paragraph" }] }) as never,
        { emitUpdate: false },
      );
    } catch { /* malformed — ignore */ }
  }, [editor, note]);

  const { peers, broadcastUpdate } = useNoteCollab({
    noteId: note?.id,
    me,
    status: editingDisabled ? "viewing" : "editing",
    enabled: !!note && !isTrashed,
    onRemoteUpdate: handleRemote,
  });
  const broadcastRef = useRef(broadcastUpdate);
  useEffect(() => { broadcastRef.current = broadcastUpdate; }, [broadcastUpdate]);
  useEffect(() => { peersExternal?.(peers.length); }, [peers.length, peersExternal]);

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
      if (!editor) return;
      if (!file.type.startsWith("image/")) return;
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("bucket", "media");
        const path = `notes/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
        form.append("path", path);
        const res = await fetch("/api/storage/upload", { method: "POST", credentials: "include", body: form });
        if (!res.ok) return;
        const json = (await res.json()) as { publicUrl: string };
        editor.chain().focus().setImage({ src: json.publicUrl }).run();
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [editor],
  );

  // When a DIFFERENT note is selected, sync title/tags/body into the editor.
  const loadedNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editor || !note) return;
    if (loadedNoteIdRef.current === note.id) return;
    loadedNoteIdRef.current = note.id;
    setTitleDraft(note.title ?? "");
    setTagsDraft(note.tags ?? []);
    setTagInput("");
    const incoming = note.body_json ?? { type: "doc", content: [{ type: "paragraph" }] };
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; pendingRef.current = {}; }
    editor.commands.setContent(incoming as never, { emitUpdate: false });
    const text = editor.getText();
    setCounts({ words: text.trim() ? text.trim().split(/\s+/).length : 0, chars: text.length });
  }, [editor, note]);

  useEffect(() => { editor?.setEditable(!editingDisabled); }, [editor, editingDisabled]);

  /* Tags */
  const commitTags = useCallback((next: string[]) => {
    setTagsDraft(next);
    onChange({ tags: next });
  }, [onChange]);
  const addTag = useCallback(() => {
    const v = tagInput.trim().replace(/^#/, "");
    if (!v) return;
    if (tagsDraft.some((x) => x.toLowerCase() === v.toLowerCase())) { setTagInput(""); return; }
    commitTags([...tagsDraft, v]);
    setTagInput("");
  }, [tagInput, tagsDraft, commitTags]);

  const folderOptions = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f] as const));
    const pathOf = (f: NotesFolderRow): string => {
      const parts = [f.name];
      let cur: NotesFolderRow | undefined = f;
      while (cur?.parent_id) { const p = byId.get(cur.parent_id); if (!p) break; parts.unshift(p.name); cur = p; }
      return parts.join(" / ");
    };
    return folders.map((f) => ({ id: f.id, path: pathOf(f) })).sort((a, b) => a.path.localeCompare(b.path));
  }, [folders]);

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
  const ownerControls = !editingDisabled && !isSharee; // owner-only chrome

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar — tools live inside a bordered "shell" panel */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-3 md:px-5 py-2.5 flex items-center gap-2 flex-wrap">
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
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageFile(f); }}
        />

        <div className="flex-1" />

        <span className="hidden sm:inline text-[10.5px] font-medium text-[var(--text-dim)] tabular-nums mr-1">
          {counts.words} {counts.words === 1 ? "word" : "words"}
        </span>

        <span className={`text-[10.5px] font-medium tabular-nums flex items-center gap-1.5 transition-opacity duration-300 ${saving === "idle" ? "opacity-0" : "opacity-100"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${saving === "saving" ? "bg-[#0066FF] animate-pulse" : saving === "saved" ? "bg-[#00CC66]" : "bg-transparent"}`} />
          <span className="text-[var(--text-dim)]">{saving === "saving" ? t("saving") : saving === "saved" ? t("saved") : ""}</span>
        </span>
      </div>

      {/* Meta row — collaborators · colour · share · folder · pin · delete */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-3 md:px-5 py-2 flex items-center gap-2 flex-wrap">
        {isViewer && (
          <span className="text-[10.5px] font-semibold px-2 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">{t("share.viewOnly")}</span>
        )}
        {note.owner_name && isSharee && (
          <span className="text-[11px] text-[var(--text-dim)]">{t("share.sharedBy")} {note.owner_name}</span>
        )}

        {peers.length > 0 && (
          <div className="flex items-center -space-x-1.5" title={peers.map((p) => `${p.name} (${p.status})`).join(", ")}>
            {peers.slice(0, 4).map((p) => {
              const initials = p.name.split(/\s+/).map((x) => x[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
              return (
                <span key={p.id} className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-[var(--bg-primary)] ${p.status === "editing" ? "bg-[#0066FF] text-white" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}>
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
            <button onClick={() => setColorOpen((v) => !v)} title={t("share.noteStyle")} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-all">
              <span className="h-3.5 w-3.5 rounded-[5px] border border-[var(--border-color)]" style={surface.swatch} />
            </button>
            {colorOpen && (
              <>
                <div className="fixed inset-0 z-[55]" onClick={() => setColorOpen(false)} />
                <div className="absolute right-0 mt-1 z-[56] w-[208px] p-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl space-y-2.5">
                  <SurfaceGroup
                    title={t("share.styleColour")}
                    items={NOTE_SURFACES.slice(0, 7)}
                    activeKey={activeSurfaceKey}
                    onPick={(key) => { onChange({ color: key === "default" ? null : key }); setColorOpen(false); }}
                  />
                  <SurfaceGroup
                    title={t("share.stylePaper")}
                    items={NOTE_SURFACES.slice(7)}
                    activeKey={activeSurfaceKey}
                    onPick={(key) => { onChange({ color: key === "default" ? null : key }); setColorOpen(false); }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Share */}
        {!isTrashed && (
          <button onClick={onShare} title={t("share.title")} className="h-8 px-2.5 rounded-lg flex items-center gap-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all text-[11.5px] font-semibold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
            <span className="hidden md:inline">{t("share.button")}</span>
          </button>
        )}

        {/* Owner-only chrome */}
        {ownerControls && (
          <select value={note.folder_id ?? ""} onChange={(e) => onMove(e.target.value || null)} className="h-8 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
            <option value="">{t("smart.none")}</option>
            {folderOptions.map((f) => (<option key={f.id} value={f.id}>{f.path}</option>))}
          </select>
        )}

        {!isTrashed ? (
          ownerControls && (
            <>
              <button onClick={onTogglePin} title={note.is_pinned ? t("unpin") : t("pin")} className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${note.is_pinned ? "bg-[#0066FF]/15 border-[#0066FF]/30 text-[#0066FF]" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
                <PinIcon className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} title={t("moveToTrash")} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-red-400 transition-all">
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )
        ) : (
          <>
            <button onClick={onRestore} className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/25 transition-all">{t("restore")}</button>
            <button onClick={onPurge} className="h-8 px-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-semibold hover:bg-red-500/25 transition-all">{t("deleteForever")}</button>
          </>
        )}
      </div>

      {/* Title + tags + body — scrollable area. The chosen surface (colour
          tint or realistic paper) washes the actual writing area. Light paper
          flips the ink dark via `notes-surface-light`. */}
      <div className={`flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-6 transition-colors duration-300 ${surface.light ? "notes-surface-light" : ""}`} style={surface.surface}>
        <input
          type="text"
          value={titleDraft}
          disabled={editingDisabled}
          placeholder={t("untitled")}
          onChange={(e) => { setTitleDraft(e.target.value); lastLocalEditAt.current = Date.now(); scheduleSave({ title: e.target.value }); }}
          className={`w-full bg-transparent text-[24px] md:text-[28px] font-bold ${inkClass} ${ghostClass} outline-none mb-2 disabled:cursor-not-allowed`}
        />

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {tagsDraft.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
              #{tag}
              {!editingDisabled && (<button onClick={() => commitTags(tagsDraft.filter((x) => x !== tag))} className="text-[var(--text-dim)] hover:text-red-400">×</button>)}
            </span>
          ))}
          {!editingDisabled && (
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } if (e.key === "Backspace" && !tagInput && tagsDraft.length) commitTags(tagsDraft.slice(0, -1)); }}
              onBlur={addTag}
              placeholder={tagsDraft.length ? "Add tag" : "Add tags…"}
              className={`h-6 min-w-[80px] bg-transparent text-[11px] ${inkClass} ${surface.light ? "placeholder:text-[#8a8a8a]" : "placeholder:text-[var(--text-dim)]"} outline-none`}
            />
          )}
        </div>

        <EditorContent editor={editor} />
      </div>

      {/* Floating table controls — appear anchored to the table you're editing */}
      <TableFloatingControls editor={editor} enabled={!editingDisabled} />

      {/* Link prompt */}
      <PromptDialog
        open={linkOpen}
        title={t("fmt.link")}
        label="URL"
        placeholder="https://example.com"
        initialValue={linkInitial}
        confirmLabel="Apply"
        onConfirm={(url) => applyLink(url)}
        onClose={() => setLinkOpen(false)}
      />
    </div>
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
}: {
  title: string;
  items: NoteSurface[];
  activeKey: string;
  onPick: (key: string) => void;
}) {
  return (
    <div>
      <div className="px-0.5 mb-1.5 text-[9.5px] uppercase tracking-[1.2px] font-semibold text-[var(--text-dim)]">
        {title}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {items.map((s) => (
          <button
            key={s.key}
            title={s.label}
            onClick={() => onPick(s.key)}
            className={`h-6 w-6 rounded-md border transition-all hover:scale-110 ${
              activeKey === s.key
                ? "ring-2 ring-[#0066FF] ring-offset-1 ring-offset-[var(--bg-secondary)] border-transparent"
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

function TableFloatingControls({ editor, enabled }: { editor: Editor | null; enabled: boolean }) {
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!editor || !enabled) { setBox(null); return; }
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
      setBox({ top, left: r.left });
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

  // onMouseDown + preventDefault keeps the table selection so the command lands.
  const Btn = ({ title, onRun, children, danger }: { title: string; onRun: () => void; children: React.ReactNode; danger?: boolean }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onRun(); }}
      className={`h-7 min-w-[28px] px-2 rounded-md text-[11px] font-semibold flex items-center justify-center transition-colors ${danger ? "text-[var(--text-dim)] hover:text-red-400 hover:bg-[var(--bg-surface)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"}`}
    >
      {children}
    </button>
  );
  const Sep = () => <span className="w-px h-4 bg-[var(--border-subtle)] mx-0.5" />;

  return createPortal(
    <div
      style={{ position: "fixed", top: box.top, left: box.left, zIndex: 60 }}
      className="flex items-center gap-0.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl px-1 py-0.5"
    >
      <Btn title="Add row below" onRun={() => editor.chain().focus().addRowAfter().run()}>+ Row</Btn>
      <Btn title="Delete current row" onRun={() => editor.chain().focus().deleteRow().run()}>− Row</Btn>
      <Sep />
      <Btn title="Add column right" onRun={() => editor.chain().focus().addColumnAfter().run()}>+ Col</Btn>
      <Btn title="Delete current column" onRun={() => editor.chain().focus().deleteColumn().run()}>− Col</Btn>
      <Sep />
      <Btn title="Toggle header row" onRun={() => editor.chain().focus().toggleHeaderRow().run()}>H</Btn>
      <Btn title="Delete whole table" danger onRun={() => editor.chain().focus().deleteTable().run()}>
        <TrashIcon className="h-3.5 w-3.5" />
      </Btn>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Toolbar — grouped: text style · colour · align · lists · insert · history.
   ═══════════════════════════════════════════════════════════════════════════ */

function EditorToolbar({
  editor,
  t,
  readOnly,
  onOpenLink,
  onUploadImage,
  uploading,
}: {
  editor: Editor | null;
  t: (k: string) => string;
  readOnly: boolean;
  onOpenLink: () => void;
  onUploadImage: () => void;
  uploading: boolean;
}) {
  const [textColorOpen, setTextColorOpen] = useState(false);
  if (!editor) return null;

  const TB = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
    <span className="relative inline-flex group/tt">
      <button
        type="button"
        disabled={readOnly}
        onClick={onClick}
        aria-label={title}
        className={`h-8 min-w-[32px] px-2 rounded-lg text-[12px] font-semibold flex items-center justify-center transition-all border ${active ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]" : "bg-transparent border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"} disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {children}
      </button>
      {/* Branded tooltip — below the button so it never collides with the
          page header above; fades in after ~0.5s of hover (delay on enter). */}
      <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 z-[70] whitespace-nowrap rounded-md bg-[var(--bg-inverted)] px-2 py-1 text-[10.5px] font-medium text-[var(--text-inverted)] shadow-lg opacity-0 transition-opacity duration-150 [transition-delay:0ms] group-hover/tt:opacity-100 group-hover/tt:[transition-delay:500ms]">
        {title}
      </span>
    </span>
  );

  const inTable = editor.isActive("table");

  // Each group is a discrete rounded "segment" so clusters stay readable even
  // when the toolbar wraps to a second row.
  const Group = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-0.5 rounded-lg bg-[var(--bg-surface)]/70 px-1 py-0.5">{children}</div>
  );

  return (
    <>
      {/* Block type */}
      <Group>
        <select
          disabled={readOnly}
          value={editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p"}
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
        <TB active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title={t("fmt.bold")}><BoldIcon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title={t("fmt.italic")}><ItalicIcon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title={t("fmt.underline")}><UnderlineIcon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title={t("fmt.strike")}><StrikethroughIcon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title={t("fmt.highlight")}><HighlighterIcon className="h-3.5 w-3.5" /></TB>
        <div className="relative">
          <TB active={editor.isActive("textStyle")} onClick={() => setTextColorOpen((v) => !v)} title={t("tt.textColour")}>
            <span className="flex flex-col items-center justify-center leading-none">
              <span className="text-[11px] font-bold">A</span>
              <span className="h-[2px] w-3.5 rounded mt-0.5" style={{ background: "#0066FF" }} />
            </span>
          </TB>
          {textColorOpen && (
            <>
              <div className="fixed inset-0 z-[55]" onClick={() => setTextColorOpen(false)} />
              <div className="absolute left-0 mt-1 z-[56] p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl flex gap-1.5 items-center">
                {TEXT_COLORS.map((c) => (
                  <button key={c} title={c} onClick={() => { editor.chain().focus().setColor(c).run(); setTextColorOpen(false); }} className="h-5 w-5 rounded-full border border-[var(--border-color)]" style={{ background: c }} />
                ))}
                <button title="Default" onClick={() => { editor.chain().focus().unsetColor().run(); setTextColorOpen(false); }} className="h-5 px-2 rounded-md text-[10px] font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">Reset</button>
              </div>
            </>
          )}
        </div>
      </Group>

      {/* Align */}
      <Group>
        <TB active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title={t("tt.alignLeft")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="14" y2="12" /><line x1="4" y1="18" x2="18" y2="18" /></svg>
        </TB>
        <TB active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title={t("tt.alignCenter")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="5" y1="18" x2="19" y2="18" /></svg>
        </TB>
        <TB active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title={t("tt.alignRight")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="6" y1="18" x2="20" y2="18" /></svg>
        </TB>
      </Group>

      {/* Lists */}
      <Group>
        <TB active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title={t("fmt.bulletList")}><ListIcon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title={t("fmt.numberedList")}><ListOrderedIcon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title={t("fmt.checklist")}><CheckSquareIcon className="h-3.5 w-3.5" /></TB>
      </Group>

      {/* Insert */}
      <Group>
        <TB active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title={t("fmt.quote")}><QuoteIcon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title={t("fmt.code")}><CodeIcon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title={t("fmt.codeBlock")}><FileCode2Icon className="h-3.5 w-3.5" /></TB>
        <TB active={editor.isActive("link")} onClick={onOpenLink} title={t("fmt.link")}><LinkIcon className="h-3.5 w-3.5" /></TB>
        <TB active={false} onClick={onUploadImage} title={t("tt.image")}>
          {uploading ? <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--text-primary)] border-t-transparent animate-spin" /> : <ImageRawIcon className="h-3.5 w-3.5" />}
        </TB>
        <TB active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} title={t("tt.divider")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="12" x2="20" y2="12" /></svg>
        </TB>
        <TB active={inTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title={t("tt.table")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="1" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
        </TB>
      </Group>

      {/* Clear + history */}
      <Group>
        <TB active={false} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title={t("tt.clear")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11l4 8M14 11l-4 8M7 7l3-3h4" /></svg>
        </TB>
        <TB onClick={() => editor.chain().focus().undo().run()} title={t("fmt.undo")}><Undo2Icon className="h-3.5 w-3.5" /></TB>
        <TB onClick={() => editor.chain().focus().redo().run()} title={t("fmt.redo")}><Redo2Icon className="h-3.5 w-3.5" /></TB>
      </Group>
    </>
  );
}
