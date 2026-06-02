"use client";

/* ---------------------------------------------------------------------------
   ClassificationManager — KOLEEX product classification, in the SAME layout as
   the Visual Library: a left sidebar (Divisions) + a toolbar + a grid of icon
   cards. You drill Division → Category → Subcategory → Type via the breadcrumb;
   each level renders as Library-style cards.

   Icons: every card has an empty white icon tile. Click it to assign an icon
   from the Visual Library (where "Icons" live) — left empty until you do.
   Create · rename · delete · reorder · search at every level. KOLEEX dark.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowDownIcon from "@/components/icons/ui/ArrowDownIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";

interface Item {
  id: string; name: string; slug: string; icon_url: string | null; sort_order: number;
  category_count?: number; subcategory_count?: number; type_count?: number;
}
interface VlIcon { id: string; title: string; visual_asset_code: string; public_url: string | null }

type LevelKey = "divisions" | "categories" | "subcategories" | "types";
const CHILD_OF: Record<Exclude<LevelKey, "types">, LevelKey> = {
  divisions: "categories", categories: "subcategories", subcategories: "types",
};
const PARENT_PARAM: Record<Exclude<LevelKey, "divisions">, string> = {
  categories: "division_id", subcategories: "category_id", types: "subcategory_id",
};
const CREATE_PARENT = PARENT_PARAM;
const SINGULAR: Record<LevelKey, string> = { divisions: "division", categories: "category", subcategories: "subcategory", types: "type" };
const childCount = (it: Item, level: LevelKey) =>
  level === "divisions" ? it.category_count : level === "categories" ? it.subcategory_count : level === "subcategories" ? it.type_count : undefined;

export default function ClassificationManager() {
  // drill trail below the root; empty = showing divisions
  const [trail, setTrail] = useState<{ level: LevelKey; id: string; name: string }[]>([]);
  const [divisions, setDivisions] = useState<Item[]>([]);
  const [divLoading, setDivLoading] = useState(true);

  // active division (sidebar selection) = first trail entry
  const activeDivId = trail[0]?.id ?? null;

  // current grid level + parent
  const level: LevelKey = trail.length === 0 ? "divisions"
    : trail.length === 1 ? "categories"
    : trail.length === 2 ? "subcategories" : "types";
  const parentId = trail.length === 0 ? "ROOT" : trail[trail.length - 1].id;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [picker, setPicker] = useState<{ base: string; id: string } | null>(null);

  const gridBase = `/api/visual-registry/${level}`;
  const divBase = "/api/visual-registry/divisions";

  const loadDivisions = useCallback(async () => {
    setDivLoading(true);
    try {
      const j = await fetch(divBase, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { divisions: [] });
      setDivisions((j.divisions ?? []) as Item[]);
    } finally { setDivLoading(false); }
  }, []);
  useEffect(() => { loadDivisions(); }, [loadDivisions]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setQ("");
    try {
      if (level === "divisions") { setItems(divisions); setLoading(false); return; }
      const param = PARENT_PARAM[level as Exclude<LevelKey, "divisions">];
      const j = await fetch(`${gridBase}?${param}=${parentId}`, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { [level]: [] });
      setItems((j[level] ?? []) as Item[]);
    } finally { setLoading(false); }
  }, [gridBase, level, parentId, divisions]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const refresh = () => { loadDivisions(); loadItems(); };

  const create = async () => {
    const name = newName.trim(); if (!name) return;
    setBusyId("new");
    const body: Record<string, unknown> = { name };
    if (level !== "divisions") body[CREATE_PARENT[level as Exclude<LevelKey, "divisions">]] = parentId;
    await fetch(gridBase, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusyId(null); setNewName(""); setAdding(false); refresh();
  };
  const rename = async (id: string) => {
    const name = editName.trim(); if (!name) { setEditId(null); return; }
    setBusyId(id);
    await fetch(`${gridBase}/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setBusyId(null); setEditId(null); refresh();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this item? (it will be archived)")) return;
    setBusyId(id);
    await fetch(`${gridBase}/${id}`, { method: "DELETE", credentials: "include" });
    setBusyId(null);
    if (trail.some((t) => t.id === id)) setTrail((prev) => prev.slice(0, prev.findIndex((t) => t.id === id)));
    refresh();
  };
  const move = async (id: string, dir: -1 | 1, list: Item[]) => {
    const idx = list.findIndex((x) => x.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= list.length) return;
    const a = list[idx], b = list[swap];
    setBusyId(id);
    await Promise.all([
      fetch(`${gridBase}/${a.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`${gridBase}/${b.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ]);
    setBusyId(null); refresh();
  };
  const assignIcon = async (icon: VlIcon | null) => {
    if (!picker) return;
    await fetch(`${picker.base}/${picker.id}`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icon_asset_id: icon?.id ?? null, icon_url: icon?.public_url ?? null }),
    });
    setPicker(null); refresh();
  };

  const drill = (it: Item) => {
    if (level === "types") return; // terminal
    const childLevel = CHILD_OF[level as Exclude<LevelKey, "types">];
    setTrail((prev) => [...prev, { level: childLevel, id: it.id, name: it.name }]);
  };
  const goTo = (depth: number) => setTrail((prev) => prev.slice(0, depth));

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? items.filter((i) => i.name.toLowerCase().includes(term) || i.slug.toLowerCase().includes(term)) : items;
  }, [items, q]);

  return (
    <div className="flex gap-5">
      {/* Divisions sidebar (Library-style) */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-2 space-y-0.5">
          <div className="mb-1.5 flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Divisions</span>
            <button type="button" onClick={() => { setTrail([]); setAdding(true); }} title="New division"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"><PlusIcon size={12} /></button>
          </div>
          {divLoading ? <div className="flex justify-center py-6 text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /></div>
            : divisions.map((d) => (
              <button key={d.id} type="button" onClick={() => setTrail([{ level: "categories", id: d.id, name: d.name }])}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
                  activeDivId === d.id ? "bg-[var(--bg-surface)] font-semibold text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"}`}>
                <span className="truncate">{d.name}</span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-[var(--text-dim)]">{d.category_count ?? 0}</span>
              </button>
            ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <Crumb label="Divisions" active={trail.length === 0} onClick={() => goTo(0)} />
          {trail.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1.5">
              <span className="text-[var(--text-dim)]">›</span>
              <Crumb label={t.name} active={i === trail.length - 1} onClick={() => goTo(i + 1)} />
            </span>
          ))}
        </nav>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 focus-within:border-[var(--border-focus)]">
            <SearchIcon size={14} className="shrink-0 text-[var(--text-dim)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${level}…`}
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]" />
          </div>
          <button type="button" onClick={() => setAdding((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] hover:opacity-90">
            <PlusIcon size={14} /> New {SINGULAR[level]}
          </button>
        </div>

        {adding && (
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              placeholder={`New ${SINGULAR[level]} name…`}
              className="min-w-0 flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
            <button type="button" disabled={busyId === "new"} onClick={create} className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] disabled:opacity-50">{busyId === "new" ? <SpinnerIcon size={12} className="animate-spin" /> : "Add"}</button>
            <button type="button" onClick={() => { setAdding(false); setNewName(""); }} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">Cancel</button>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-16 text-center">
            <ImageRawIcon size={32} className="text-[var(--text-dim)]" />
            <p className="mt-3 text-[13px] font-medium text-[var(--text-muted)]">{q ? "Nothing matches" : `No ${level} yet`}</p>
            <p className="mt-1 text-[12px] text-[var(--text-dim)]">{q ? "Try another search term." : `Use “New ${SINGULAR[level]}” to add one.`}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((it, idx) => (
              <ClassificationCard
                key={it.id} item={it} level={level} count={childCount(it, level)}
                busy={busyId === it.id} editing={editId === it.id} editName={editName}
                onEditName={setEditName} onCommitRename={() => rename(it.id)} onCancelRename={() => setEditId(null)}
                onStartRename={() => { setEditId(it.id); setEditName(it.name); }}
                onDelete={() => remove(it.id)}
                onMoveUp={!q && idx > 0 ? () => move(it.id, -1, filtered) : undefined}
                onMoveDown={!q && idx < filtered.length - 1 ? () => move(it.id, 1, filtered) : undefined}
                onOpenIcon={() => setPicker({ base: gridBase, id: it.id })}
                onDrill={level !== "types" ? () => drill(it) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {picker && <IconPicker onClose={() => setPicker(null)} onPick={assignIcon} />}
    </div>
  );
}

/* One Library-style card. Empty white icon tile (click → assign from Library). */
function ClassificationCard({
  item, level, count, busy, editing, editName, onEditName, onCommitRename, onCancelRename,
  onStartRename, onDelete, onMoveUp, onMoveDown, onOpenIcon, onDrill,
}: {
  item: Item; level: LevelKey; count?: number; busy: boolean; editing: boolean; editName: string;
  onEditName: (v: string) => void; onCommitRename: () => void; onCancelRename: () => void;
  onStartRename: () => void; onDelete: () => void; onMoveUp?: () => void; onMoveDown?: () => void;
  onOpenIcon: () => void; onDrill?: () => void;
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
      {/* hover actions */}
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onMoveUp && <CardBtn title="Move up" onClick={onMoveUp}><ArrowUpIcon size={11} /></CardBtn>}
        {onMoveDown && <CardBtn title="Move down" onClick={onMoveDown}><ArrowDownIcon size={11} /></CardBtn>}
        <CardBtn title="Rename" onClick={onStartRename}><PencilIcon size={11} /></CardBtn>
        <CardBtn title="Delete" tone="rose" onClick={onDelete}><TrashIcon size={11} /></CardBtn>
      </div>

      {/* icon tile — empty by default; click to assign a Visual Library icon */}
      <button type="button" onClick={onOpenIcon} title={item.icon_url ? "Change icon" : "Add icon from Visual Library"}
        className="flex aspect-square w-full items-center justify-center bg-white p-3 text-neutral-900">
        {busy ? <SpinnerIcon size={18} className="animate-spin text-neutral-400" /> : item.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.icon_url} alt={item.name} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-neutral-300">
            <ImageRawIcon size={20} />
            <span className="text-[8px] font-semibold uppercase tracking-wide">No icon</span>
          </span>
        )}
      </button>

      {/* footer */}
      {editing ? (
        <div className="border-t border-[var(--border-subtle)] p-1.5">
          <input autoFocus value={editName} onChange={(e) => onEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onCommitRename(); if (e.key === "Escape") onCancelRename(); }}
            onBlur={onCommitRename}
            className="w-full rounded border border-[var(--border-focus)] bg-[var(--bg-card)] px-1.5 py-1 text-[11px] text-[var(--text-primary)] outline-none" />
        </div>
      ) : (
        <button type="button" onClick={onDrill ?? onOpenIcon} className="flex flex-col items-start gap-0.5 border-t border-[var(--border-subtle)] px-2 py-1.5 text-left">
          <div className="flex w-full items-center justify-between gap-1.5">
            <span className="truncate text-[11px] font-medium text-[var(--text-primary)]">{item.name}</span>
            {count !== undefined ? (
              <span className="shrink-0 rounded-full bg-[var(--bg-card)] px-1.5 text-[9px] font-semibold tabular-nums text-[var(--text-dim)]">{count}</span>
            ) : level === "types" ? (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-dim)] opacity-40" />
            ) : null}
          </div>
          <span className="truncate font-mono text-[9px] text-[var(--text-dim)]">{item.slug}</span>
        </button>
      )}
    </div>
  );
}

function CardBtn({ children, title, onClick, tone }: { children: React.ReactNode; title: string; onClick: () => void; tone?: "rose" }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)]/90 text-[var(--text-dim)] backdrop-blur hover:text-[var(--text-primary)] ${tone === "rose" ? "hover:text-rose-400" : ""}`}>
      {children}
    </button>
  );
}

function Crumb({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`max-w-[200px] truncate ${active ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}>{label}</button>;
}

/* Pick / clear a Visual Library icon. */
function IconPicker({ onClose, onPick }: { onClose: () => void; onPick: (icon: VlIcon | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<VlIcon[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    let alive = true; setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/visual-library?q=${encodeURIComponent(q.trim())}&pageSize=24`, { credentials: "include", cache: "no-store" })
        .then((r) => r.ok ? r.json() : { assets: [] })
        .then((j) => { if (alive) setResults((j.assets ?? []).filter((a: VlIcon) => a.public_url)); })
        .catch(() => {}).finally(() => { if (alive) setLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center bg-black/60 pt-20" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">Choose an icon from the Visual Library</span>
          <button type="button" onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={14} /></button>
        </div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Visual Library icons…"
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
        <div className="mt-2 min-h-[120px]">
          {loading ? <div className="flex justify-center py-6 text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /></div>
            : results.length === 0 ? <p className="py-6 text-center text-[11.5px] text-[var(--text-dim)]">{q.trim().length < 2 ? "Type to search the Visual Library…" : "No icons found."}</p>
            : (
              <div className="grid grid-cols-6 gap-1.5">
                {results.map((a) => (
                  <button key={a.id} type="button" title={a.title} onClick={() => onPick(a)}
                    className="flex aspect-square items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white hover:border-[var(--border-focus)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.public_url!} alt={a.title} className="h-6 w-6 object-contain" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5">
          <span className="text-[10.5px] text-[var(--text-dim)]">Icons live in the Visual Library.</span>
          <button type="button" onClick={() => onPick(null)} className="text-[11.5px] font-medium text-[var(--text-dim)] hover:text-rose-400">Clear icon</button>
        </div>
      </div>
    </div>
  );
}
