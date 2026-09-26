"use client";

/* ---------------------------------------------------------------------------
   FoldersSidebar — left pane. Lists smart folders at the top (All,
   Pinned, Unfiled, Shared with me), then user folders with multi-level
   nesting, then Tags (the caller's tags with counts — a tag is a filter
   view), then Trash. "Shared with me" carries a badge with the number of
   shared notes not opened yet. Each folder row has add-subfolder / rename / delete
   actions (shown on hover, keyboard focus, and always on touch screens).
   Counts come from the server (live notes per folder), not the visible list.
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
import UsersIcon from "@/components/icons/ui/UsersIcon";
import PinIcon from "@/components/icons/ui/PinIcon";
import NotesIcon from "@/components/icons/NotesIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import type { NotesFolderRow, TagCount } from "@/lib/notes";

export type FolderSelection =
  | { kind: "folder"; id: string }
  | { kind: "tag"; tag: string }
  | { kind: "smart"; key: "all" | "pinned" | "none" | "shared" | "trash" };

const TAGS_COLLAPSED = 12;

export default function FoldersSidebar({
  folders,
  selection,
  onSelect,
  onAskCreateFolder,
  onAskRenameFolder,
  onAskDeleteFolder,
  notesCountByFolder,
  tags = [],
  sharedUnread = 0,
}: {
  folders: NotesFolderRow[];
  selection: FolderSelection;
  onSelect: (sel: FolderSelection) => void;
  /** These open Hub-styled dialogs in the parent instead of doing the
   *  work inline — keeps the sidebar dumb + visual. */
  onAskCreateFolder: (parentId: string | null) => void;
  onAskRenameFolder: (folder: NotesFolderRow) => void;
  onAskDeleteFolder: (id: string) => void;
  notesCountByFolder: Record<string, number>;
  tags?: TagCount[];
  /** Notes shared with me that I have not opened yet. */
  sharedUnread?: number;
}) {
  const { t } = useTranslation(notesT);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [allTags, setAllTags] = useState(false);
  const shownTags = allTags ? tags : tags.slice(0, TAGS_COLLAPSED);

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

  const handleCreateRoot = () => onAskCreateFolder(null);
  const handleCreateChild = (parentId: string) => {
    onAskCreateFolder(parentId);
    setExpanded((prev) => new Set(prev).add(parentId));
  };
  const handleRename = (folder: NotesFolderRow) => onAskRenameFolder(folder);

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
          tint="text-[var(--text-muted)]"
          active={selection.kind === "smart" && selection.key === "all"}
          onClick={() => onSelect({ kind: "smart", key: "all" })}
        />
        <SmartItem
          label={t("smart.pinned")}
          Icon={PinIcon}
          tint="text-[#567FB2] dark:text-[#7FA9D6]"
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
        <SmartItem
          label={t("smart.shared")}
          Icon={UsersIcon}
          tint="text-[#567FB2] dark:text-[#7FA9D6]"
          active={selection.kind === "smart" && selection.key === "shared"}
          onClick={() => onSelect({ kind: "smart", key: "shared" })}
          badge={sharedUnread > 0 ? { count: sharedUnread, label: t("shared.unreadAria") } : undefined}
        />
      </nav>

      {/* Folders header */}
      <div className="px-3 flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[1.5px] font-semibold text-[var(--text-dim)]">
          {t("folders")}
        </span>
        <button
          type="button"
          onClick={handleCreateRoot}
          title={t("newFolder")}
          aria-label={t("newFolder")}
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
          onDelete={onAskDeleteFolder}
          notesCountByFolder={notesCountByFolder}
          t={t}
        />
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <nav aria-label={t("tags.title")} className="mt-5">
          <div className="px-3 flex items-center gap-1.5 mb-1.5">
            <TagsIcon className="h-3 w-3 text-[var(--text-dim)]" />
            <span className="text-[10px] uppercase tracking-[1.5px] font-semibold text-[var(--text-dim)]">
              {t("tags.title")}
            </span>
          </div>
          <ul className="px-2 space-y-0.5">
            {shownTags.map((tg) => {
              const active = selection.kind === "tag" && selection.tag === tg.tag;
              return (
                <li key={tg.tag}>
                  <button
                    type="button"
                    onClick={() => onSelect({ kind: "tag", tag: tg.tag })}
                    aria-current={active ? "true" : undefined}
                    aria-label={`${t("tags.filterAria")} #${tg.tag} (${tg.count})`}
                    className={`w-full h-7 px-2.5 rounded-lg flex items-center gap-2 text-[12.5px] transition-all ${
                      active
                        ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)] font-semibold"
                        : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span aria-hidden className={active ? "text-[#567FB2] dark:text-[#7FA9D6]" : "text-[var(--text-faint)]"}>#</span>
                    <span dir="auto" className="truncate flex-1 text-start">{tg.tag}</span>
                    <span className="text-[10.5px] text-[var(--text-faint)] shrink-0 tabular-nums">{tg.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {tags.length > TAGS_COLLAPSED && (
            <button
              type="button"
              onClick={() => setAllTags((v) => !v)}
              aria-expanded={allTags}
              className="mx-2 mt-0.5 h-7 px-2.5 rounded-lg text-[11.5px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              {allTags ? t("folder.collapse") : `${t("folder.expand")} (${tags.length - TAGS_COLLAPSED})`}
            </button>
          )}
        </nav>
      )}

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
  badge,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tint: string;
  active: boolean;
  onClick: () => void;
  badge?: { count: number; label: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`w-full h-8 px-2.5 rounded-lg flex items-center gap-2.5 transition-all text-[13px] ${
        active
          ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)] font-semibold"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[var(--text-primary)]" : tint}`} />
      <span className="truncate flex-1 text-start">{label}</span>
      {badge && (
        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#567FB2] text-white text-[10px] font-bold leading-[18px] text-center tabular-nums">
          {badge.count > 99 ? "99+" : badge.count}
          <span className="sr-only"> {badge.label}</span>
        </span>
      )}
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
  t,
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
  notesCountByFolder: Record<string, number>;
  t: (k: string) => string;
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
        const count = notesCountByFolder[f.id] ?? 0;

        return (
          <div key={f.id}>
            <div
              className={`group flex items-center gap-1 rounded-lg pe-1 transition-all ${
                isActive
                  ? "bg-[var(--bg-surface-active)]"
                  : "hover:bg-[var(--bg-surface)]"
              }`}
              style={{ paddingInlineStart: 4 + depth * 14 }}
            >
              <button
                type="button"
                onClick={() => hasChildren && toggle(f.id)}
                tabIndex={hasChildren ? 0 : -1}
                aria-hidden={hasChildren ? undefined : true}
                aria-expanded={hasChildren ? isOpen : undefined}
                aria-label={hasChildren ? `${isOpen ? t("folder.collapse") : t("folder.expand")} ${f.name}` : undefined}
                className={`w-4 h-4 flex items-center justify-center shrink-0 text-[var(--text-faint)] ${
                  hasChildren ? "hover:text-[var(--text-primary)]" : "invisible"
                }`}
              >
                {isOpen ? (
                  <AngleDownIcon className="h-3 w-3" />
                ) : (
                  <AngleRightIcon className="h-3 w-3 rtl:-scale-x-100" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelect({ kind: "folder", id: f.id })}
                aria-current={isActive ? "true" : undefined}
                className={`flex-1 min-w-0 h-8 flex items-center gap-2 text-[13px] text-start ${
                  isActive
                    ? "text-[var(--text-primary)] font-semibold"
                    : "text-[var(--text-muted)]"
                }`}
              >
                <FolderIcon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isActive ? "text-[#567FB2] dark:text-[#7FA9D6]" : "text-[var(--text-faint)]"
                  }`}
                />
                <span className="truncate flex-1">{f.name}</span>
                {count > 0 && (
                  <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">
                    {count}
                  </span>
                )}
              </button>

              {/* Row actions — hover, keyboard focus, and always on touch */}
              <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onCreateChild(f.id)}
                  title={t("newSubfolder")}
                  aria-label={`${t("newSubfolder")} — ${f.name}`}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                >
                  <PlusIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onRename(f)}
                  title={t("rename")}
                  aria-label={`${t("rename")} — ${f.name}`}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                >
                  <PencilIcon className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(f.id)}
                  title={t("delete")}
                  aria-label={`${t("delete")} — ${f.name}`}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-dim)] hover:text-red-700 dark:hover:text-red-400 hover:bg-[var(--bg-surface-subtle)]"
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
                t={t}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
