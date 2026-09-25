/* ---------------------------------------------------------------------------
   notes-schema — THE document schema of a note, in one place.

   The editor (browser) and the API (server: seeding a shared note's Yjs
   state from body_json) must agree on every node, mark and attribute, or a
   CRDT round-trip silently drops content. So both build their schema from
   this list; the editor then adds its UI-only extensions (placeholder,
   slash menu, [[ picker, collaboration) on top.

   No directive on purpose: imported by client and server. Nothing here
   touches the DOM at module load.
   --------------------------------------------------------------------------- */

import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
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

/** Yjs XML fragment the note body lives in (Collaboration's default). */
export const NOTES_YJS_FIELD = "default";

/**
 * A checklist item that can remember the To-do it was turned into
 * (`data-todo-id`). Plain TaskItem otherwise.
 */
export const NoteTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      todoId: {
        default: null,
        keepOnSplit: false,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-todo-id"),
        renderHTML: (attrs: { todoId?: string | null }) =>
          attrs.todoId ? { "data-todo-id": attrs.todoId } : {},
      },
    };
  },
});

/**
 * Schema-bearing extensions. `collab: true` drops StarterKit's own undo
 * history — Collaboration brings a Yjs-aware undo manager instead (the two
 * must never run together).
 */
export function notesSchemaExtensions(opts: { collab?: boolean } = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false,
      underline: false,
      ...(opts.collab ? { undoRedo: false } : {}),
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    TextStyle,
    Color,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    NoteTaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false, autolink: true }),
    Image.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: "notes-image" } }),
  ];
}

/* ── Note links ─────────────────────────────────────────────────────────── */

const NOTE_LINK_RE = /^\/notes\?id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function noteLinkHref(id: string): string {
  return `/notes?id=${id}`;
}

/** The note id an in-app note link points at, or null for any other href. */
export function parseNoteLink(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const m = NOTE_LINK_RE.exec(href.trim());
  return m ? m[1].toLowerCase() : null;
}

/** Every note id a TipTap document links to (deduplicated, capped). */
export function extractNoteLinks(doc: unknown, max = 200): string[] {
  const out = new Set<string>();
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object" || out.size >= max) return;
    const node = n as { marks?: Array<{ type?: string; attrs?: { href?: unknown } }>; content?: unknown[] };
    for (const m of node.marks ?? []) {
      if (m?.type === "link") {
        const id = parseNoteLink(m.attrs?.href);
        if (id) out.add(id);
      }
    }
    if (Array.isArray(node.content)) for (const c of node.content) walk(c);
  };
  walk(doc);
  return Array.from(out);
}
