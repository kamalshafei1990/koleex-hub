"use client";

/* ---------------------------------------------------------------------------
   FoldersSidebar — left pane. Lists smart folders at the top (All,
   Pinned, Unfiled, Trash), then user folders with multi-level nesting.
   Right-click or tap the ··· menu to rename / delete / add subfolder.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { notesT } from "@/lib/translations/notes";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import FolderIcon from "@/components/icons/ui/FolderIcon";
import FileIcon from "@/components/icons/ui/FileIcon";
import PinIcon from "@/components/icons/ui/PinIcon";
import NotesIcon from "@/components/icons/NotesIcon";
import type { NotesFolderRow } from "@/lib/notes";

export type FolderSelection =
  | { kind: "folder"; id: string }
  | { kind: "smart"; key: "all" | "pinned" | "none" | "trash" };

export default function FoldersSidebar({
  folders,
  selection,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  notesCountByFolder,
}: {
  folders: NotesFolderRow[];
  selection: FolderSelection;
  onSelect: (sel: FolderSelection) => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  notesCountByFolder: Map<string, number>;
}) {
  const { t } = useTranslation(notesT);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build a tree from the flat folder list.
  const tree = useMemo(() => {
    const children = new Map<string | null, NotesFolderRow[]>();
    for (const f of folders) {
      const key = f.parent_id ?? null;
      const arr = children.get(key) ?? [];
      arr.push(f);
      children.set(key, arr);
    }
    for (const arr of children.values()) {
      arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    }
    return children;
  }, [folders]);

  function handleCreateRoot() {
    const name = window.prompt(t("folderName"), "");
    if (name?.trim()) onCreateFolder(name.trim(), null);
  }

  function handleCreateChild(parentId: string) {
    const name = window.prompt(t("folderName"), "");
    if (name?.trim()) onCreateFolder(name.trim(), parentId);
    setExpanded((prev) => new Set(prev).add(parentId));
  }

  function handleRename(folder: NotesFolderRow) {
    const next = window.prompt(t("folderName"), folder.name);
    if (next?.trim() && next.trim() !== folder.name) {
      onRenameFolder(folder.id, next.trim());
    }
  }

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="py-3">
      {/* Smart folders */}
      <nav className="px-2 mb-4 space-y-0.5">
        <SmartItem
          label={t("smart.allNotes")}
          Icon={NotesIcon}
          tint="text-amber-400"
          active={selection.kind === "smart" && selection.key === "all"}
          onClick={() => onSelect({ kind: "smart", key: "all" })}
        />
        <SmartItem
          label={t("smart.pinned")}
          Icon={PinIcon}
          tint="text-amber-400"
          active={selection.kind === "smart" && selection.key === "pinned"}
          onClick={() => onSelect({ kind: "smart", key: "pinned" })}
        />
        <SmartItem
          label={t("smart.none")}
          Icon={FileIcon}
          tint="text-[var(--text-muted)]"
          active={selection.kind === "smart" && selection.key === "none"}
          onClick={() => onSelect({ kind: "smart", key: "none" })}
        />
      </nav>

      {/* Folders header */}
      <div className="px-3 flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[1.5px] font-semibold text-[var(--text-dim)]">
          {t("folders")}
        </span>
        <button
          onClick={handleCreateRoot}
          title={t("newFolder")}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-1 space-y-0.5">
        <FolderTree
          parent={null}
          tree={tree}
          depth={0}
          expanded={expanded}
          toggle={toggle}
          selection={selection}
          onSelect={onSelect}
          onCreateChild={handleCreateChild}
          onRename={handleRename}
          onDelete={onDeleteFolder}
          notesCountByFolder={notesCountByFolder}
        />
      </div>

      {/* Trash */}
      <nav className="px-2 mt-5 pt-3 border-t border-[var(--border-subtle)] space-y-0.5">
        <SmartItem
          label={t("smart.trash")}
          Icon={TrashIcon}
          tint="text-[var(--text-muted)]"
          active={selection.kind === "smart" && selection.key === "trash"}
          onClick={() => onSelect({ kind: "smart", key: "trash" })}
        />
      </nav>
    </div>
  );
}

function SmartItem({
  label,
  Icon,
  tint,
  active,
  onClick,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 transition-all text-[13px] ${
        active
          ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)] font-semibold"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[var(--text-primary)]" : tint}`} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function FolderTree({
  parent,
  tree,
  depth,
  expanded,
  toggle,
  selection,
  onSelect,
  onCreateChild,
  onRename,
  onDelete,
  notesCountByFolder,
}: {
  parent: string | null;
  tree: Map<string | null, NotesFolderRow[]>;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selection: FolderSelection;
  onSelect: (sel: FolderSelection) => void;
  onCreateChild: (parentId: string) => void;
  onRename: (f: NotesFolderRow) => void;
  onDelete: (id: string) => void;
  notesCountByFolder: Map<string, number>;
}) {
  const children = tree.get(parent) ?? [];
  if (children.length === 0) return null;

  return (
    <>
      {children.map((f) => {
        const grand = tree.get(f.id) ?? [];
        const hasChildren = grand.length > 0;
        const isOpen = expanded.has(f.id);
        const isActive = selection.kind === "folder" && selection.id === f.id;
        const count = notesCountByFolder.get(f.id) ?? 0;

        return (
          <div key={f.id}>
            <div
              className={`group flex items-center gap-1 rounded-lg pr-1 transition-all ${
                isActive
                  ? "bg-[var(--bg-surface-active)]"
                  : "hover:bg-[var(--bg-surface)]"
              }`}
              style={{ paddingInlineStart: 4 + depth * 14 }}
            >
              <button
                onClick={() => hasChildren && toggle(f.id)}
                className={`w-4 h-4 flex items-center justify-center shrink-0 text-[var(--text-faint)] ${
                  hasChildren ? "hover:text-[var(--text-primary)]" : "invisible"
                }`}
              >
                {isOpen ? (
                  <AngleDownIcon className="h-3 w-3" />
                ) : (
                  <AngleRightIcon className="h-3 w-3" />
                )}
              </button>

              <button
                onClick={() => onSelect({ kind: "folder", id: f.id })}
                className={`flex-1 min-w-0 h-8 flex items-center gap-2 text-[13px] text-start ${
                  isActive
                    ? "text-[var(--text-primary)] font-semibold"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <FolderIcon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isActive ? "text-amber-400" : "text-[var(--text-faint)]"
                  }`}
                />
                <span className="truncate flex-1">{f.name}</span>
                {count > 0 && (
                  <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">
                    {count}
                  </span>
                )}
              </button>

              {/* Row actions — visible on hover */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                <button
                  onClick={() => onCreateChild(f.id)}
                  title="New subfolder"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                >
                  <PlusIcon className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onRename(f)}
                  title="Rename"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onDelete(f.id)}
                  title="Delete"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-red-400 hover:bg-[var(--bg-surface-subtle)]"
                >
                  <TrashIcon className="h-3 w-3" />
                </button>
              </div>
            </div>

            {isOpen && hasChildren && (
              <FolderTree
                parent={f.id}
                tree={tree}
                depth={depth + 1}
                expanded={expanded}
                toggle={toggle}
                selection={selection}
                onSelect={onSelect}
                onCreateChild={onCreateChild}
                onRename={onRename}
                onDelete={onDelete}
                notesCountByFolder={notesCountByFolder}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
