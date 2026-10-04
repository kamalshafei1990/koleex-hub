"use client";

/* ---------------------------------------------------------------------------
   Floating editor controls:

     · ChecklistTodoControl — while the caret is in a checklist item, a small
       chip floats above it: "Create to-do" (POST /api/todos; the new To-do
       id is stored on the item as data-todo-id) or, once linked,
       "Open to-do".
     · MobileFormatBar — phones only: a compact formatting row pinned just
       above the on-screen keyboard (tracked with visualViewport) while the
       editor has focus. Buttons never take focus from the editor.
   --------------------------------------------------------------------------- */

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEditorState, type Editor } from "@tiptap/react";
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import BoldIcon from "@/components/icons/ui/BoldIcon";
import ItalicIcon from "@/components/icons/ui/ItalicIcon";
import UnderlineIcon from "@/components/icons/ui/UnderlineIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import CheckSquareIcon from "@/components/icons/ui/CheckSquareIcon";
import Heading2Icon from "@/components/icons/ui/Heading2Icon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import Undo2Icon from "@/components/icons/ui/Undo2Icon";
import Redo2Icon from "@/components/icons/ui/Redo2Icon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";

type T = (k: string) => string;

/** The checklist item around the caret: its position, text and todo id. */
export function taskItemAtSelection(editor: Editor): { pos: number; text: string; todoId: string | null } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "taskItem") {
      // The item's own text: its first paragraph, not nested sub-items.
      const first = node.firstChild;
      const text = (first && first.type.name === "paragraph" ? first.textContent : node.textContent).trim();
      return { pos: $from.before(d), text, todoId: (node.attrs.todoId as string | null) ?? null };
    }
  }
  return null;
}

export function ChecklistTodoControl({
  editor,
  canCreate,
  busy,
  onCreate,
  onOpen,
  t,
}: {
  editor: Editor | null;
  canCreate: boolean;
  busy: boolean;
  onCreate: () => void;
  onOpen: (todoId: string) => void;
  t: T;
}) {
  const [box, setBox] = useState<{ top: number; start: number; rtl: boolean; todoId: string | null } | null>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      if (!editor.isFocused && !busy) { setBox(null); return; }
      const item = taskItemAtSelection(editor);
      if (!item) { setBox(null); return; }
      let dom: globalThis.Node | null = null;
      try { dom = editor.view.nodeDOM(item.pos); } catch { dom = null; }
      const li = dom instanceof HTMLElement ? dom : null;
      if (!li) { setBox(null); return; }
      const r = li.getBoundingClientRect();
      const rtl = getComputedStyle(li).direction === "rtl";
      const top = r.top < 96 ? r.bottom + 4 : r.top - 30;
      const start = rtl ? window.innerWidth - r.right : r.left;
      setBox((prev) =>
        prev && prev.top === top && prev.start === start && prev.todoId === item.todoId && prev.rtl === rtl
          ? prev
          : { top, start, rtl, todoId: item.todoId },
      );
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
  }, [editor, busy]);

  if (!editor || !box || (!box.todoId && !canCreate)) return null;

  const pos = box.rtl ? { right: box.start } : { left: box.start };
  return createPortal(
    <div style={{ position: "fixed", top: box.top, ...pos, zIndex: 60 }}>
      <button
        type="button"
        disabled={busy}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (box.todoId ? onOpen(box.todoId) : onCreate())}
        className="h-7 px-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60"
      >
        {busy ? (
          <SpinnerIcon className="h-3.5 w-3.5" />
        ) : box.todoId ? (
          <ExternalLinkIcon className="h-3.5 w-3.5 text-[#567FB2] dark:text-[#7FA9D6] rtl:-scale-x-100" />
        ) : (
          <ClipboardCheckIcon className="h-3.5 w-3.5 text-[#567FB2] dark:text-[#7FA9D6]" />
        )}
        {box.todoId ? t("todo.open") : t("todo.create")}
      </button>
    </div>,
    document.body,
  );
}

/* ── Mobile formatting bar ─────────────────────────────────────────────── */

function MB({ label, active, onRun, children }: { label: string; active?: boolean; onRun: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      // Keep the editor focused (and the keyboard up).
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className={`h-10 min-w-[40px] px-2 rounded-lg flex items-center justify-center shrink-0 ${
        active ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-muted)] active:bg-[var(--bg-surface)]"
      }`}
    >
      {children}
    </button>
  );
}

export function MobileFormatBar({
  editor,
  enabled,
  onImage,
  onVisibleChange,
  t,
}: {
  editor: Editor | null;
  enabled: boolean;
  onImage: () => void;
  onVisibleChange?: (v: boolean) => void;
  t: T;
}) {
  const [phone, setPhone] = useState(false);
  const [focused, setFocused] = useState(false);
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const read = () => setPhone(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    if (!editor) return;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const onFocus = () => { if (hideTimer) clearTimeout(hideTimer); setFocused(true); };
    // A short grace period: tapping a bar button must not flicker it away.
    const onBlur = () => { hideTimer = setTimeout(() => setFocused(false), 150); };
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with the (new) editor instance
    setFocused(editor.isFocused);
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
    };
  }, [editor]);

  /* Keep the bar glued to the top of the on-screen keyboard. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const place = () => setBottom(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    place();
    vv.addEventListener("resize", place);
    vv.addEventListener("scroll", place);
    return () => {
      vv.removeEventListener("resize", place);
      vv.removeEventListener("scroll", place);
    };
  }, []);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            bold: e.isActive("bold"),
            italic: e.isActive("italic"),
            underline: e.isActive("underline"),
            h2: e.isActive("heading", { level: 2 }),
            bullet: e.isActive("bulletList"),
            task: e.isActive("taskList"),
          }
        : null,
  });

  const visible = phone && enabled && focused && !!editor && !!s;
  useEffect(() => { onVisibleChange?.(visible); }, [visible, onVisibleChange]);
  if (!visible || !editor || !s) return null;

  return createPortal(
    <div
      role="toolbar"
      aria-label={t("mobileBar.label")}
      style={{ position: "fixed", insetInline: 0, bottom, zIndex: 70 }}
      className="kx-glass-pop md:hidden border-t border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-[0_-4px_16px_rgba(0,0,0,0.12)] pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="flex items-center gap-0.5 overflow-x-auto px-1.5 py-1">
        <MB label={t("fmt.heading")} active={s.h2} onRun={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2Icon className="h-4 w-4" /></MB>
        <MB label={t("fmt.bold")} active={s.bold} onRun={() => editor.chain().focus().toggleBold().run()}><BoldIcon className="h-4 w-4" /></MB>
        <MB label={t("fmt.italic")} active={s.italic} onRun={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon className="h-4 w-4" /></MB>
        <MB label={t("fmt.underline")} active={s.underline} onRun={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></MB>
        <MB label={t("fmt.bulletList")} active={s.bullet} onRun={() => editor.chain().focus().toggleBulletList().run()}><ListIcon className="h-4 w-4" /></MB>
        <MB label={t("fmt.checklist")} active={s.task} onRun={() => editor.chain().focus().toggleTaskList().run()}><CheckSquareIcon className="h-4 w-4" /></MB>
        <MB label={t("slash.title")} onRun={() => {
          // "/" opens the block menu when it starts a word.
          const { $from } = editor.state.selection;
          const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, " ", " ");
          editor.chain().focus().insertContent(!before || /\s/.test(before) ? "/" : " /").run();
        }}><span className="text-[15px] font-bold leading-none">/</span></MB>
        <MB label={t("tt.image")} onRun={onImage}><ImageRawIcon className="h-4 w-4" /></MB>
        <MB label={t("fmt.undo")} onRun={() => editor.chain().focus().undo().run()}><Undo2Icon className="h-4 w-4" /></MB>
        <MB label={t("fmt.redo")} onRun={() => editor.chain().focus().redo().run()}><Redo2Icon className="h-4 w-4" /></MB>
        <span className="flex-1" />
        <MB label={t("dialog.close")} onRun={() => editor.commands.blur()}><AngleDownIcon className="h-4 w-4" /></MB>
      </div>
    </div>,
    document.body,
  );
}
