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

import { Extension, type AnyExtension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
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

/* ── Conflict copies ─────────────────────────────────────────────────────
   A block kept twice by a 3-way merge (notes-merge3) is flagged with the
   LANGUAGE-NEUTRAL attribute `conflict: true` (HTML: data-conflict="1") —
   never with label text, which would be frozen in the saver's language.
   The editor draws the label in the VIEWER's language as a widget
   decoration; Backspace at the start of the block clears the flag. Older
   notes whose copies carry a literal italic "Conflict copy:" prefix are
   left exactly as they are. */

const CONFLICT_BLOCKS = ["paragraph", "heading", "codeBlock"];

/* ── Restored blocks ─────────────────────────────────────────────────────
   A block re-inserted because someone typed in it while it was deleted
   elsewhere (notes-yjs-rescue) carries `restoredFrom` = the Yjs id of the
   deleted original, so a second rescuer of the same block recognises it
   instead of inserting a duplicate. Internal: never rendered, never parsed
   from HTML (a pasted copy must not look like the rescued block), not kept
   on split. Any block can be rescued, so every block type carries it. */
const RESTORABLE_BLOCKS = [
  "paragraph", "heading", "codeBlock", "blockquote", "bulletList", "orderedList", "listItem",
  "taskList", "taskItem", "table", "tableRow", "tableCell", "tableHeader", "image", "horizontalRule",
];

/** Marker attributes that are stored only when set (see stripMarkerDefaults). */
const MARKER_ATTRS = ["conflict", "restoredFrom"] as const;

/**
 * The document JSON with unset marker attributes removed (`conflict: null`,
 * `restoredFrom: null`, and an `attrs` object left empty by that), so saved
 * bodies look exactly as they did before the markers existed. Pure; the
 * input is not modified. Readers accept both forms (a missing attribute
 * takes its default).
 */
export function stripMarkerDefaults<T>(json: T): T {
  const walk = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(walk);
    if (!n || typeof n !== "object") return n;
    const src = n as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (k === "content") { out[k] = walk(v); continue; }
      if (k === "attrs" && v && typeof v === "object" && !Array.isArray(v)) {
        const attrs: Record<string, unknown> = { ...(v as Record<string, unknown>) };
        for (const m of MARKER_ATTRS) if (m in attrs && (attrs[m] === null || attrs[m] === false || attrs[m] === undefined || attrs[m] === "")) delete attrs[m];
        if (Object.keys(attrs).length) out[k] = attrs;
        continue;
      }
      out[k] = v;
    }
    return out;
  };
  return walk(json) as T;
}
const conflictKey = new PluginKey<{ label: string; set: DecorationSet }>("noteConflictLabel");

function conflictDecorations(doc: PMNode, label: string): DecorationSet {
  if (!label) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.attrs.conflict) {
      decos.push(Decoration.widget(pos + 1, () => {
        const el = document.createElement("span");
        el.className = "notes-conflict-label";
        el.contentEditable = "false";
        el.textContent = `${label} `;
        el.style.fontStyle = "italic";
        el.style.opacity = "0.6";
        el.style.userSelect = "none";
        return el;
      }, { side: -1, key: `conflict:${label}`, ignoreSelection: true }));
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

export const NoteConflictMarker = Extension.create<{ getLabel: (() => string) | null }>({
  name: "noteConflictMarker",
  // Ahead of the core keymap, so Backspace clears the flag before joining.
  priority: 1000,
  addOptions() {
    return { getLabel: null };
  },
  addGlobalAttributes() {
    return [{
      types: CONFLICT_BLOCKS,
      attributes: {
        conflict: {
          default: null,
          keepOnSplit: false,
          parseHTML: (el: HTMLElement) => (el.getAttribute("data-conflict") === "1" ? true : null),
          renderHTML: (attrs: { conflict?: unknown }) => (attrs.conflict ? { "data-conflict": "1" } : {}),
        },
      },
    }, {
      types: RESTORABLE_BLOCKS,
      attributes: {
        restoredFrom: {
          default: null,
          keepOnSplit: false,
          rendered: false,
          parseHTML: () => null,
        },
      },
    }];
  },
  addKeyboardShortcuts() {
    return {
      // Backspace at the very start of a conflict copy drops the flag first.
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const $from = selection.$from;
        if (!selection.empty || $from.parentOffset !== 0 || !$from.parent.attrs.conflict) return false;
        return editor.commands.updateAttributes($from.parent.type.name, { conflict: null });
      },
    };
  },
  addProseMirrorPlugins() {
    const getLabel = this.options.getLabel;
    if (!getLabel) return []; // server / schema-only use
    return [new Plugin({
      key: conflictKey,
      state: {
        init: (_cfg, state) => {
          const label = getLabel();
          return { label, set: conflictDecorations(state.doc, label) };
        },
        apply: (tr, prev, _old, state) => {
          const label = getLabel();
          if (!tr.docChanged && label === prev.label) return prev;
          return { label, set: conflictDecorations(state.doc, label) };
        },
      },
      props: { decorations: (state) => conflictKey.getState(state)?.set ?? null },
    })];
  },
});

/**
 * Schema-bearing extensions. `collab: true` drops StarterKit's own undo
 * history — Collaboration brings a Yjs-aware undo manager instead (the two
 * must never run together).
 */
export function notesSchemaExtensions(opts: { collab?: boolean; conflictLabel?: () => string } = {}): AnyExtension[] {
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
    NoteConflictMarker.configure({ getLabel: opts.conflictLabel ?? null }),
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
