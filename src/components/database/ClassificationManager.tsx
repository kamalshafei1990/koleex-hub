"use client";

/* ---------------------------------------------------------------------------
   ClassificationManager — a simple, fast 4-column hierarchy manager for the
   KOLEEX product classification:  Divisions → Categories → Subcategories → Types.

   Each column: search · add · list · icon · rename · delete · reorder.
   No AI, DNA, coverage, health or intelligence — just structure.

   Icons: a classification icon is a Visual Library icon (the Visual Library is
   where "Icons" live). The icon slot is empty by default; clicking it opens a
   picker that links an existing Visual Library icon — it does not create a
   separate icon. KOLEEX dark / minimal, Notion-sidebar feel.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowDownIcon from "@/components/icons/ui/ArrowDownIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";

interface Item { id: string; name: string; slug: string; icon_url: string | null; icon_asset_id?: string | null; sort_order: number }
interface VlIcon { id: string; title: string; visual_asset_code: string; public_url: string | null }

interface Level {
  key: "divisions" | "categories" | "subcategories" | "types";
  title: string; listKey: string; itemKey: string; parentParam?: string; createParent?: string;
}
const LEVELS: Level[] = [
  { key: "divisions", title: "Divisions", listKey: "divisions", itemKey: "division" },
  { key: "categories", title: "Categories", listKey: "categories", itemKey: "category", parentParam: "division_id", createParent: "division_id" },
  { key: "subcategories", title: "Subcategories", listKey: "subcategories", itemKey: "subcategory", parentParam: "category_id", createParent: "category_id" },
  { key: "types", title: "Types", listKey: "types", itemKey: "type", parentParam: "subcategory_id", createParent: "subcategory_id" },
];

export default function ClassificationManager() {
  const [sel, setSel] = useState<[string | null, string | null, string | null]>([null, null, null]);
  // shared icon picker: { base, id } of the item being assigned
  const [picker, setPicker] = useState<{ base: string; id: string; refresh: () => void } | null>(null);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {LEVELS.map((lvl, i) => {
        const parentId = i === 0 ? "ROOT" : sel[i - 1];
        return (
          <ManagerColumn
            key={lvl.key}
            level={lvl}
            parentId={parentId}
            selectedId={sel[i] ?? null}
            onSelect={(id) => setSel((prev) => {
              const next = [...prev] as typeof prev;
              next[i] = id;
              for (let j = i + 1; j < next.length; j++) next[j] = null;
              return next;
            })}
            openPicker={(base, id, refresh) => setPicker({ base, id, refresh })}
          />
        );
      })}

      {picker && (
        <IconPicker
          onClose={() => setPicker(null)}
          onPick={async (icon) => {
            await fetch(`${picker.base}/${picker.id}`, {
              method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ icon_asset_id: icon?.id ?? null, icon_url: icon?.public_url ?? null }),
            });
            picker.refresh(); setPicker(null);
          }}
        />
      )}
    </div>
  );
}

function ManagerColumn({ level, parentId, selectedId, onSelect, openPicker }: {
  level: Level; parentId: string | null; selectedId: string | null; onSelect: (id: string | null) => void;
  openPicker: (base: string, id: string, refresh: () => void) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const baseUrl = `/api/visual-registry/${level.key}`;
  const enabled = parentId !== null;

  const load = useCallback(async () => {
    if (!enabled) { setItems([]); return; }
    setLoading(true);
    const url = level.parentParam && parentId !== "ROOT" ? `${baseUrl}?${level.parentParam}=${parentId}` : baseUrl;
    try {
      const j = await fetch(url, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { [level.listKey]: [] });
      setItems((j[level.listKey] ?? []) as Item[]);
    } finally { setLoading(false); }
  }, [baseUrl, level.parentParam, level.listKey, parentId, enabled]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const name = newName.trim(); if (!name) return;
    setBusyId("new");
    const body: Record<string, unknown> = { name };
    if (level.createParent && parentId && parentId !== "ROOT") body[level.createParent] = parentId;
    await fetch(baseUrl, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusyId(null); setNewName(""); setAdding(false); await load();
  };
  const rename = async (id: string) => {
    const name = editName.trim(); if (!name) { setEditId(null); return; }
    setBusyId(id);
    await fetch(`${baseUrl}/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setBusyId(null); setEditId(null); await load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this item? (it will be archived)")) return;
    setBusyId(id);
    await fetch(`${baseUrl}/${id}`, { method: "DELETE", credentials: "include" });
    setBusyId(null);
    if (selectedId === id) onSelect(null);
    await load();
  };
  const move = async (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) return;
    const a = items[idx], b = items[swapIdx];
    setBusyId(id);
    await Promise.all([
      fetch(`${baseUrl}/${a.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`${baseUrl}/${b.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ]);
    setBusyId(null); await load();
  };

  const filtered = q.trim() ? items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase())) : items;

  return (
    <div className="flex h-[68vh] flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5">
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">{level.title}</span>
        <span className="text-[10.5px] tabular-nums text-[var(--text-dim)]">{enabled ? filtered.length : "—"}</span>
      </div>

      {!enabled ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-[11.5px] text-[var(--text-dim)]">
          Select a {LEVELS[LEVELS.findIndex((l) => l.key === level.key) - 1]?.title.slice(0, -1).toLowerCase()} first.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] px-2.5 py-2">
            <div className="relative flex-1">
              <SearchIcon size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1.5 pl-7 pr-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
            </div>
            <button type="button" onClick={() => setAdding((v) => !v)} title="Add"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90"><PlusIcon size={13} /></button>
          </div>

          {adding && (
            <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-2">
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
                placeholder={`New ${level.title.slice(0, -1).toLowerCase()} name…`}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
              <button type="button" disabled={busyId === "new"} onClick={create} className="rounded-lg bg-[var(--bg-inverted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-inverted)] disabled:opacity-50">{busyId === "new" ? <SpinnerIcon size={11} className="animate-spin" /> : "Add"}</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-1.5">
            {loading ? (
              <div className="flex justify-center py-10 text-[var(--text-dim)]"><SpinnerIcon size={15} className="animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-[11.5px] text-[var(--text-dim)]">{q ? "No matches." : "No items yet."}</p>
            ) : filtered.map((it, idx) => {
              const active = selectedId === it.id;
              const isEditing = editId === it.id;
              return (
                <div key={it.id}
                  className={`group mb-1 flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${active ? "border-[var(--accent)]/40 bg-[var(--accent)]/10" : "border-transparent hover:bg-[var(--bg-surface-hover)]"}`}>
                  {/* Icon slot — links a Visual Library icon; empty by default */}
                  <button type="button" onClick={() => openPicker(baseUrl, it.id, load)} title={it.icon_url ? "Change Visual Library icon" : "Choose icon from Visual Library"}
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-subtle)] bg-white text-neutral-300 hover:border-[var(--border-focus)]">
                    {busyId === it.id ? <SpinnerIcon size={12} className="animate-spin text-neutral-500" /> : it.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.icon_url} alt="" className="h-5 w-5 object-contain" />
                    ) : <ImageRawIcon size={13} />}
                  </button>

                  {isEditing ? (
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") rename(it.id); if (e.key === "Escape") setEditId(null); }}
                      onBlur={() => rename(it.id)}
                      className="min-w-0 flex-1 rounded border border-[var(--border-focus)] bg-[var(--bg-card)] px-1.5 py-1 text-[12px] text-[var(--text-primary)] outline-none" />
                  ) : (
                    <button type="button" onClick={() => onSelect(active ? null : it.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[12.5px] text-[var(--text-primary)]">{it.name}</span>
                      <span className="block truncate font-mono text-[9.5px] text-[var(--text-dim)]">{it.slug}</span>
                    </button>
                  )}

                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <IconBtn title="Move up" disabled={idx === 0 || !!q} onClick={() => move(it.id, -1)}><ArrowUpIcon size={11} /></IconBtn>
                    <IconBtn title="Move down" disabled={idx === filtered.length - 1 || !!q} onClick={() => move(it.id, 1)}><ArrowDownIcon size={11} /></IconBtn>
                    <IconBtn title="Rename" onClick={() => { setEditId(it.id); setEditName(it.name); }}><PencilIcon size={11} /></IconBtn>
                    <IconBtn title="Delete" tone="rose" onClick={() => remove(it.id)}><TrashIcon size={11} /></IconBtn>
                  </div>

                  {level.key !== "types" && !isEditing && (
                    <span className={`shrink-0 ${active ? "text-[var(--accent)]" : "text-[var(--text-dim)] opacity-40 group-hover:opacity-100"}`}>›</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* Pick / clear a Visual Library icon for a classification node. */
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

function IconBtn({ children, title, onClick, disabled, tone }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; tone?: "rose" }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-card)] disabled:opacity-25 disabled:hover:bg-transparent ${tone === "rose" ? "hover:text-rose-400" : "hover:text-[var(--text-primary)]"}`}>
      {children}
    </button>
  );
}
