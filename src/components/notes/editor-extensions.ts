"use client";

/* ---------------------------------------------------------------------------
   Editor-only TipTap extensions for Notes (no schema of their own):

     · SlashCommand — type "/" to open the block menu (headings, lists,
       checklist, table, divider, quote, code, image).
     · NoteLinkPicker — type "[[" to search your notes and insert a link to
       /notes?id=<id> (the link mark itself is the ordinary Link mark, so
       the document schema — and the server's copy of it — is unchanged).

   Both render through a MenuBridge owned by NoteEditor: the Suggestion
   plugin reports open / update / keydown / exit, the bridge keeps the
   visible state in React and answers keyboard navigation synchronously.
   --------------------------------------------------------------------------- */

import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from "@tiptap/suggestion";

/** One row of either menu. `run` performs the action (after the trigger
 *  text has been removed by it). */
export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
  /** Extra search words (English, so "/table" works in every language). */
  keywords?: string;
  run: (editor: Editor, range: Range) => void;
}

export type MenuKind = "slash" | "link";

export interface MenuBridge {
  open: (kind: MenuKind, props: SuggestionProps<MenuItem, MenuItem>) => void;
  keyDown: (kind: MenuKind, props: SuggestionKeyDownProps) => boolean;
  close: (kind: MenuKind) => void;
}

interface MenuExtOptions {
  /** Read lazily — the bridge lives in the component. */
  getBridge: () => MenuBridge | null;
  getItems: (query: string, editor: Editor) => MenuItem[] | Promise<MenuItem[]>;
}

function renderVia(kind: MenuKind, getBridge: () => MenuBridge | null) {
  return () => ({
    onStart: (props: SuggestionProps<MenuItem, MenuItem>) => getBridge()?.open(kind, props),
    onUpdate: (props: SuggestionProps<MenuItem, MenuItem>) => getBridge()?.open(kind, props),
    onKeyDown: (props: SuggestionKeyDownProps) => getBridge()?.keyDown(kind, props) ?? false,
    onExit: () => getBridge()?.close(kind),
  });
}

export const SlashCommand = Extension.create<MenuExtOptions>({
  name: "notesSlashCommand",
  addOptions() {
    return { getBridge: () => null, getItems: () => [] };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion<MenuItem, MenuItem>({
        editor: this.editor,
        pluginKey: new PluginKey("notesSlash"),
        char: "/",
        allowSpaces: false,
        allow: ({ editor }) => editor.isEditable && !editor.isActive("codeBlock"),
        items: ({ query, editor }) => this.options.getItems(query, editor),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: renderVia("slash", this.options.getBridge),
      }),
    ];
  },
});

export const NoteLinkPicker = Extension.create<MenuExtOptions>({
  name: "notesLinkPicker",
  addOptions() {
    return { getBridge: () => null, getItems: () => [] };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion<MenuItem, MenuItem>({
        editor: this.editor,
        pluginKey: new PluginKey("notesLinkPicker"),
        char: "[[",
        allowSpaces: true,
        allowedPrefixes: null,
        allow: ({ editor }) => editor.isEditable && !editor.isActive("codeBlock"),
        items: ({ query, editor }) => this.options.getItems(query, editor),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: renderVia("link", this.options.getBridge),
      }),
    ];
  },
});
