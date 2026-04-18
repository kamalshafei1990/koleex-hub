"use client";

/* ---------------------------------------------------------------------------
   NoteEditor — right pane. TipTap-based rich text editor with:
     • Title input at the top (separate from the body)
     • Formatting toolbar
     • Auto-save (500ms debounce after typing stops)
     • "Saving…" / "Saved" indicator
     • Move-to-folder dropdown, Pin toggle, Delete button
   --------------------------------------------------------------------------- */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";

import { useTranslation } from "@/lib/i18n";
import { notesT } from "@/lib/translations/notes";
import type { NoteFull, NotesFolderRow } from "@/lib/notes";
import PinIcon from "@/components/icons/ui/PinIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import NotesIcon from "@/components/icons/NotesIcon";

export default function NoteEditor({
  note,
  folders,
  readOnly,
  saving,
  onChange,
  onMove,
  onTogglePin,
  onDelete,
  onRestore,
  onPurge,
}: {
  note: NoteFull | null;
  folders: NotesFolderRow[];
  readOnly: boolean;
  saving: "idle" | "saving" | "saved";
  onChange: (updates: { title?: string; body_json?: unknown }) => void;
  onMove: (folderId: string | null) => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const { t } = useTranslation(notesT);
  const [titleDraft, setTitleDraft] = useState(note?.title ?? "");

  /* Single editor instance for the whole app life. When the user
     switches notes we swap content imperatively (see effect below) —
     recreating the editor on every switch was causing UI flicker and
     losing undo history. */
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
    ],
    content: null,
    editable: !readOnly,
    autofocus: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "notes-editor prose prose-invert prose-sm md:prose-base max-w-none focus:outline-none min-h-[60vh] text-[var(--text-primary)]",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      scheduleSaveRef.current?.({ body_json: json });
    },
  });

  // Debounced auto-save ────────────────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ title?: string; body_json?: unknown }>({});

  const scheduleSave = useCallback(
    (next: { title?: string; body_json?: unknown }) => {
      if (readOnly) return;
      pendingRef.current = { ...pendingRef.current, ...next };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const payload = pendingRef.current;
        pendingRef.current = {};
        onChange(payload);
      }, 500);
    },
    [onChange, readOnly],
  );

  // Stable ref so the editor instance (created once) can always reach
  // the latest scheduleSave without re-creating the editor.
  const scheduleSaveRef = useRef(scheduleSave);
  useEffect(() => {
    scheduleSaveRef.current = scheduleSave;
  }, [scheduleSave]);

  // When a DIFFERENT note is selected, sync title + body into the
  // editor. We only swap on note.id change, not on every note prop
  // change, so typing doesn't get overwritten by our own saved value
  // bouncing back through parent state.
  const loadedNoteIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editor || !note) return;
    if (loadedNoteIdRef.current === note.id) return;
    loadedNoteIdRef.current = note.id;
    setTitleDraft(note.title ?? "");
    const incoming = note.body_json ?? { type: "doc", content: [{ type: "paragraph" }] };
    // Flush any pending save from the previous note before swapping.
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      pendingRef.current = {};
    }
    editor.commands.setContent(incoming as never, { emitUpdate: false });
  }, [editor, note]);

  // Keep editability in sync with read-only (Trash) mode.
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  const folderOptions = useMemo(() => {
    // Sort for the dropdown: by full path name.
    const byId = new Map(folders.map((f) => [f.id, f] as const));
    const pathOf = (f: NotesFolderRow): string => {
      const parts = [f.name];
      let cur: NotesFolderRow | undefined = f;
      while (cur?.parent_id) {
        const p = byId.get(cur.parent_id);
        if (!p) break;
        parts.unshift(p.name);
        cur = p;
      }
      return parts.join(" / ");
    };
    return folders
      .map((f) => ({ id: f.id, path: pathOf(f) }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [folders]);

  // Empty state
  if (!note) {
    return (
      <div className="h-full min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-faint)]">
          <NotesIcon size={24} />
        </div>
        <div className="text-[13px] text-[var(--text-muted)]">
          {t("selectOne")}
        </div>
      </div>
    );
  }

  const isTrashed = note.deleted_at !== null;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] px-4 md:px-6 py-2 flex items-center gap-2 flex-wrap">
        <EditorToolbar editor={editor} t={t} readOnly={readOnly} />

        <div className="flex-1" />

        {/* Save indicator */}
        <span className="text-[11px] text-[var(--text-dim)] w-16 text-end tabular-nums">
          {saving === "saving"
            ? t("saving")
            : saving === "saved"
              ? t("saved")
              : ""}
        </span>

        {/* Folder selector */}
        {!readOnly && (
          <select
            value={note.folder_id ?? ""}
            onChange={(e) => onMove(e.target.value || null)}
            className="h-8 px-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          >
            <option value="">{t("smart.none")}</option>
            {folderOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.path}
              </option>
            ))}
          </select>
        )}

        {!readOnly ? (
          <>
            <button
              onClick={onTogglePin}
              title={note.is_pinned ? t("unpin") : t("pin")}
              className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
                note.is_pinned
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
              }`}
            >
              <PinIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              title={t("moveToTrash")}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-red-400 transition-all"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onRestore}
              className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold hover:bg-emerald-500/25 transition-all"
            >
              {t("restore")}
            </button>
            <button
              onClick={onPurge}
              className="h-8 px-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-[11px] font-semibold hover:bg-red-500/25 transition-all"
            >
              {t("deleteForever")}
            </button>
          </>
        )}
      </div>

      {/* Title + body — scrollable area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-12 py-6">
        <input
          type="text"
          value={titleDraft}
          disabled={readOnly || isTrashed}
          placeholder={t("untitled")}
          onChange={(e) => {
            setTitleDraft(e.target.value);
            scheduleSave({ title: e.target.value });
          }}
          className="w-full bg-transparent text-[24px] md:text-[28px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none mb-4 disabled:cursor-not-allowed"
        />

        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Toolbar — heading levels, inline formatting, lists, quote/code, link.
   ═══════════════════════════════════════════════════════════════════════════ */

import type { Editor } from "@tiptap/react";

function EditorToolbar({
  editor,
  t,
  readOnly,
}: {
  editor: Editor | null;
  t: (k: string) => string;
  readOnly: boolean;
}) {
  if (!editor) return null;

  const TB = ({
    active,
    onClick,
    title,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      disabled={readOnly}
      onClick={onClick}
      title={title}
      className={`h-8 min-w-[32px] px-2 rounded-lg text-[12px] font-semibold flex items-center justify-center transition-all border ${
        active
          ? "bg-[var(--bg-surface-active)] border-[var(--border-focus)] text-[var(--text-primary)]"
          : "bg-transparent border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );

  const Divider = () => (
    <span className="w-px h-5 bg-[var(--border-subtle)] mx-1" />
  );

  function promptLink() {
    if (!editor) return;
    const current = editor.getAttributes("link").href ?? "";
    const url = window.prompt(t("linkPrompt"), current);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <>
      {/* Paragraph / headings */}
      <select
        disabled={readOnly}
        value={
          editor.isActive("heading", { level: 1 })
            ? "h1"
            : editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
                ? "h3"
                : "p"
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") editor.chain().focus().setParagraph().run();
          else
            editor
              .chain()
              .focus()
              .toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 })
              .run();
        }}
        className="h-8 px-2 rounded-lg bg-transparent border border-transparent hover:bg-[var(--bg-surface)] text-[12px] text-[var(--text-primary)] outline-none cursor-pointer"
      >
        <option value="p">{t("fmt.body")}</option>
        <option value="h1">{t("fmt.title")}</option>
        <option value="h2">{t("fmt.heading")}</option>
        <option value="h3">{t("fmt.subheading")}</option>
      </select>

      <Divider />

      <TB
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title={t("fmt.bold")}
      >
        <span className="font-bold">B</span>
      </TB>
      <TB
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title={t("fmt.italic")}
      >
        <span className="italic">I</span>
      </TB>
      <TB
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title={t("fmt.underline")}
      >
        <span className="underline">U</span>
      </TB>
      <TB
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title={t("fmt.strike")}
      >
        <span className="line-through">S</span>
      </TB>
      <TB
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title={t("fmt.highlight")}
      >
        <span className="px-1 rounded-sm bg-amber-300/40 text-amber-200">Hl</span>
      </TB>

      <Divider />

      <TB
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title={t("fmt.bulletList")}
      >
        •
      </TB>
      <TB
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title={t("fmt.numberedList")}
      >
        1.
      </TB>
      <TB
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title={t("fmt.checklist")}
      >
        ✓
      </TB>

      <Divider />

      <TB
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title={t("fmt.quote")}
      >
        ❝
      </TB>
      <TB
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title={t("fmt.code")}
      >
        &lt;/&gt;
      </TB>
      <TB
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title={t("fmt.codeBlock")}
      >
        {"{}"}
      </TB>

      <Divider />

      <TB active={editor.isActive("link")} onClick={promptLink} title={t("fmt.link")}>
        🔗
      </TB>

      <Divider />

      <TB
        onClick={() => editor.chain().focus().undo().run()}
        title={t("fmt.undo")}
      >
        ↶
      </TB>
      <TB
        onClick={() => editor.chain().focus().redo().run()}
        title={t("fmt.redo")}
      >
        ↷
      </TB>
    </>
  );
}
