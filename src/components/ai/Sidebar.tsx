"use client";

/* ---------------------------------------------------------------------------
   components/ai/Sidebar — the conversation list's rows, headings and menu.

   Phase 2J, sliced verbatim from KoleexAiApp.tsx. Four prop-only components
   plus the date grouper they are rendered from. Grouped in one file because
   they are one concern: what the left panel is made of.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ProjectGlyph from "@/components/ai/ProjectGlyph";
import type { AiProject } from "@/lib/ai-projects";
import MoreHorizontalIcon from "@/components/icons/ui/MoreHorizontalIcon";
import PinIcon from "@/components/icons/ui/PinIcon";
import PinOffIcon from "@/components/icons/ui/PinOffIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import type { ConversationRow, MenuItem } from "@/components/ai/types";
import { COPY } from "@/components/ai/copy";

/* ── Sidebar section heading ──
   A date, "Projects" and "Pinned" are all chrome, not content. The label used
   to be 10px bold text at rgba(255,255,255,0.44) sitting directly above chat
   rows at 0.66 — two greys a fifth of an alpha apart, same left edge, no
   separator — so "Yesterday" scanned as just another chat. The hairline rule
   and the sticky behaviour are what make it read as a divider; every section
   in the sidebar now shares this one component so they cannot drift apart. */
export function SectionHeader({
  label,
  children,
  muted,
}: {
  label: string;
  children?: React.ReactNode;
  /** Date sub-headings inside the history — quieter than "Projects" /
   *  "Recents", which name the two halves of the panel. */
  muted?: boolean;
}) {
  return (
    <div className="px-4 pt-4 pb-1 flex items-center gap-2">
      <span
        className={`text-[12px] font-semibold shrink-0 ${
          muted ? "text-[var(--text-dim)]" : "text-[var(--text-primary)]"
        }`}
      >
        {label}
      </span>
      <span className="flex-1" />
      {children}
    </div>
  );
}

/* ── A project folder row ──
   Same shape as a chat row — icon, name, hover menu — because in the panel
   they are peers: two kinds of thing you click to go somewhere. No chevron
   and no count; the folder opens the panel rather than unfolding in place. */
export function ProjectRow({
  project,
  onOpen,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  moreLabel,
}: {
  project: AiProject;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
  moreLabel: string;
}) {
  return (
    <div
      className="group px-2 py-1.5 mx-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2 hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); }
      }}
    >
      <ProjectGlyph icon={project.icon} color={project.color} size={15} className="shrink-0" />
      <span className="text-[13px] truncate flex-1 min-w-0">{project.name}</span>
      <RowMenu
        label={moreLabel}
        items={[
          { key: "edit", label: editLabel, icon: <PencilIcon className="h-3 w-3" />, onSelect: onEdit },
          { key: "delete", label: deleteLabel, icon: <TrashIcon className="h-3 w-3" />, danger: true, onSelect: onDelete },
        ]}
      />
    </div>
  );
}

/* ── Sidebar row with hover actions ── */

export function SidebarRow({
  row,
  active,
  projects,
  copy,
  onOpen,
  onRename,
  onDelete,
  onTogglePin,
  onMove,
  hint,
}: {
  row: ConversationRow;
  active: boolean;
  projects: AiProject[];
  copy: typeof COPY["en"];
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onMove: (projectId: string | null) => void;
  /** Where the search matched inside the chat (roadmap C2): one dim line
   *  under the title, only while searching. Absent means the row is as it
   *  always was. */
  hint?: string;
}) {
  const pinned = !!row.pinned;
  const inProject = row.project_id ?? null;

  /* Rename, pin, move and delete are four actions on a 248px row — as inline
     buttons they would leave the title barely wider than a word. Pin stays
     out (it is the one you reach for mid-thought, and it has to stay visible
     when ON so you can see the chat is pinned); the rest live behind one
     menu, which is also where "move to a folder" belongs since it needs the
     project list. */
  const items: MenuItem[] = [
    {
      key: "pin",
      label: pinned ? copy.unpin : copy.pin,
      icon: pinned ? <PinOffIcon className="h-3 w-3" /> : <PinIcon className="h-3 w-3" />,
      onSelect: onTogglePin,
    },
    {
      key: "rename",
      label: copy.rename,
      icon: <PencilIcon className="h-3 w-3" />,
      onSelect: onRename,
    },
    { key: "sep-move", separator: true, label: copy.moveTo },
    {
      key: "none",
      label: copy.noProject,
      selected: inProject === null,
      onSelect: () => onMove(null),
    },
    ...projects.map((p) => ({
      key: `p-${p.id}`,
      label: p.name,
      icon: <ProjectGlyph icon={p.icon} color={p.color} size={12} />,
      selected: inProject === p.id,
      onSelect: () => onMove(p.id),
    })),
    { key: "sep-danger", separator: true },
    {
      key: "delete",
      label: copy.delete,
      icon: <TrashIcon className="h-3 w-3" />,
      danger: true,
      onSelect: onDelete,
    },
  ];

  return (
    <div
      onClick={onOpen}
      className={`group px-2 py-1.5 mx-2 rounded-lg cursor-pointer transition-colors flex items-center gap-1 ${
        active
          ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
          : "hover:bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] truncate">{row.title}</div>
        {hint && <div className="text-[11px] truncate text-[var(--text-dim)]" data-search-hint>{hint}</div>}
      </div>
      {/* The pin marks the row while it is pinned and hides again on hover so
          it can't be mistaken for a button you have to press to keep it. */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${
          pinned
            ? "text-[var(--text-dim)] group-hover:text-[var(--text-primary)]"
            : "opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-[var(--text-primary)]"
        }`}
        title={pinned ? copy.unpin : copy.pin}
        aria-label={pinned ? copy.unpin : copy.pin}
        aria-pressed={pinned}
      >
        <PinIcon className="h-3 w-3" />
      </button>
      <RowMenu label={copy.more} items={items} />
    </div>
  );
}

/* ── The one-button row menu ──
   Rendered `position: fixed` against the trigger's own rectangle rather than
   absolutely inside the row. The sidebar list is an overflow-y-auto column,
   which clips on BOTH axes, so an absolutely-positioned panel would have its
   edge sliced off — and a menu you cannot fully see is worse than no menu. */

export function RowMenu({
  label,
  items,
  alwaysVisible,
}: {
  label: string;
  items: MenuItem[];
  /** The project header's menu has no row to hover — it stays put. */
  alwaysVisible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 208;
    const GAP = 4;
    const EDGE = 8;
    const PREFERRED_H = 320;

    const below = window.innerHeight - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    /* Open downwards when there is room, otherwise flip above. When flipping
       we anchor the panel's BOTTOM edge to the button instead of guessing a
       top: the menu's height depends on how many projects exist, and a top
       computed from the maximum height would leave a short menu floating a
       hundred pixels away from the button that opened it. */
    const dropDown = below >= Math.min(PREFERRED_H, above) || below >= 200;
    const left = Math.min(Math.max(EDGE, r.right - W), window.innerWidth - W - EDGE);

    setPos(
      dropDown
        ? { top: r.bottom + GAP, left, maxHeight: Math.max(120, below) }
        : { bottom: window.innerHeight - r.top + GAP, left, maxHeight: Math.max(120, above) },
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    /* Any scroll or resize invalidates a fixed position, and re-placing a
       menu mid-scroll looks broken — closing is the honest response. */
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!open) place();
          setOpen((v) => !v);
        }}
        className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 text-[var(--text-dim)] hover:text-[var(--text-primary)] ${
          open || alwaysVisible
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100"
        } ${open ? "text-[var(--text-primary)]" : ""}`}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontalIcon size={14} />
      </button>

      {open && pos && createPortal(
        <>
          {/* Click-catcher. Transparent, not dimmed — this is a small row
              menu, not a modal, and the house rule about blurring backdrops
              is about dialogs that take over the screen. */}
          <div
            className="fixed inset-0 z-[60]"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            onContextMenu={(e) => { e.preventDefault(); setOpen(false); }}
          />
          {/* MN-5 canon: kx-pop-panel is the shell + (under aurora) the
              frosted material. PORTALLED to <body>, and that part is
              load-bearing: this menu used to render inside the sidebar,
              whose .kx-glass-drawer backdrop-filter both starves any
              descendant blur and made the "glass" read as a flat
              see-through box (owner: "not frosted blurred glass"). */}
          <div
            role="menu"
            className="kx-pop-panel fixed z-[61] w-52 overflow-y-auto py-1"
            style={{
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              maxHeight: Math.min(320, pos.maxHeight),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((it) =>
              it.separator ? (
                <div key={it.key} className="px-3 pt-2 pb-1">
                  {it.label ? (
                    <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-dim)]">
                      {it.label}
                    </span>
                  ) : (
                    <span className="block h-px bg-[var(--border-subtle)]" />
                  )}
                </div>
              ) : (
                <button
                  key={it.key}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    it.onSelect?.();
                  }}
                  className={`w-full px-3 py-1.5 text-[12px] flex items-center gap-2 text-start hover:bg-[var(--bg-surface-subtle)] ${
                    it.danger
                      ? "text-rose-400"
                      : it.selected
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                  }`}
                >
                  <span className="w-3 shrink-0 flex justify-center">{it.icon}</span>
                  <span className="truncate flex-1 min-w-0">{it.label}</span>
                  {it.selected && <CheckIcon className="h-3 w-3 shrink-0" />}
                </button>
              ),
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}


/* ── Date grouping ── */

export function groupByDate(
  rows: ConversationRow[],
  copy: typeof COPY["en"],
): Array<{ label: string; rows: ConversationRow[] }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 86_400_000;
  const bucket = {
    today: [] as ConversationRow[],
    yesterday: [] as ConversationRow[],
    week: [] as ConversationRow[],
    month: [] as ConversationRow[],
    older: [] as ConversationRow[],
  };
  for (const r of rows) {
    const t = new Date(r.updated_at).getTime();
    const diff = today - t;
    if (t >= today) bucket.today.push(r);
    else if (diff < oneDay) bucket.yesterday.push(r);
    else if (diff < 7 * oneDay) bucket.week.push(r);
    else if (diff < 30 * oneDay) bucket.month.push(r);
    else bucket.older.push(r);
  }
  const out: Array<{ label: string; rows: ConversationRow[] }> = [];
  if (bucket.today.length) out.push({ label: copy.today, rows: bucket.today });
  if (bucket.yesterday.length) out.push({ label: copy.yesterday, rows: bucket.yesterday });
  if (bucket.week.length) out.push({ label: copy.previous7, rows: bucket.week });
  if (bucket.month.length) out.push({ label: copy.previous30, rows: bucket.month });
  if (bucket.older.length) out.push({ label: copy.earlier, rows: bucket.older });
  return out;
}
