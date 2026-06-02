"use client";

/* ---------------------------------------------------------------------------
   ClassificationManager — a simple, fast 4-column hierarchy manager for the
   KOLEEX product classification:  Divisions → Categories → Subcategories → Types.

   Each column: search · add · list · icon preview + upload · rename · delete ·
   reorder. No AI, DNA, coverage, health, intelligence — just structure.
   Apple-settings / Notion-sidebar feel. KOLEEX dark / minimal.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { uploadToStorage } from "@/lib/storage-client";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowDownIcon from "@/components/icons/ui/ArrowDownIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";

interface Item { id: string; name: string; slug: string; icon_url: string | null; sort_order: number }

interface Level {
  key: "divisions" | "categories" | "subcategories" | "types";
  title: string;
  listKey: string;       // response array key
  itemKey: string;       // create response single key
  parentParam?: string;  // query param for parent filter
  createParent?: string;  // body field for parent id
  iconDir: string;
}
const LEVELS: Level[] = [
  { key: "divisions", title: "Divisions", listKey: "divisions", itemKey: "division", iconDir: "divisions" },
  { key: "categories", title: "Categories", listKey: "categories", itemKey: "category", parentParam: "division_id", createParent: "division_id", iconDir: "categories" },
  { key: "subcategories", title: "Subcategories", listKey: "subcategories", itemKey: "subcategory", parentParam: "category_id", createParent: "category_id", iconDir: "subcategories" },
  { key: "types", title: "Types", listKey: "types", itemKey: "type", parentParam: "subcategory_id", createParent: "subcategory_id", iconDir: "types" },
];

export default function ClassificationManager() {
  // selected id at each level (drives the next column)
  const [sel, setSel] = useState<[string | null, string | null, string | null]>([null, null, null]);

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
              for (let j = i + 1; j < next.length; j++) next[j] = null; // clear downstream
              return next;
            })}
          />
        );
      })}
    </div>
  );
}

function ManagerColumn({ level, parentId, selectedId, onSelect }: {
  level: Level; parentId: string | null; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<string | null>(null);

  const base = `/api/visual-registry/${level.key}`;
  const enabled = parentId !== null; // root column always enabled (parentId="ROOT")

  const load = useCallback(async () => {
    if (!enabled) { setItems([]); return; }
    setLoading(true);
    const url = level.parentParam && parentId !== "ROOT" ? `${base}?${level.parentParam}=${parentId}` : base;
    try {
      const j = await fetch(url, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { [level.listKey]: [] });
      setItems((j[level.listKey] ?? []) as Item[]);
    } finally { setLoading(false); }
  }, [base, level.parentParam, level.listKey, parentId, enabled]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const name = newName.trim(); if (!name) return;
    setBusyId("new");
    const body: Record<string, unknown> = { name };
    if (level.createParent && parentId && parentId !== "ROOT") body[level.createParent] = parentId;
    await fetch(base, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusyId(null); setNewName(""); setAdding(false); await load();
  };
  const rename = async (id: string) => {
    const name = editName.trim(); if (!name) { setEditId(null); return; }
    setBusyId(id);
    await fetch(`${base}/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setBusyId(null); setEditId(null); await load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this item? (it will be archived)")) return;
    setBusyId(id);
    await fetch(`${base}/${id}`, { method: "DELETE", credentials: "include" });
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
      fetch(`${base}/${a.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: b.sort_order }) }),
      fetch(`${base}/${b.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: a.sort_order }) }),
    ]);
    setBusyId(null); await load();
  };
  const pickIcon = (id: string) => { uploadTarget.current = id; fileRef.current?.click(); };
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; const id = uploadTarget.current;
    e.target.value = "";
    if (!f || !id) return;
    const item = items.find((x) => x.id === id);
    setBusyId(id);
    try {
      const ext = (f.name.split(".").pop() ?? "png").toLowerCase();
      const path = `classification/${level.iconDir}/${item?.slug ?? id}.${ext}`;
      const up = await uploadToStorage("media", path, f, { upsert: true, contentType: f.type || "image/svg+xml" });
      if (up.ok) {
        await fetch(`${base}/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ icon_url: up.data.publicUrl }) });
        await load();
      }
    } finally { setBusyId(null); uploadTarget.current = null; }
  };

  const filtered = q.trim() ? items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase())) : items;

  return (
    <div className="flex h-[68vh] flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/*" className="hidden" onChange={onFile} />
      {/* Header */}
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
          {/* Search + add */}
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

          {/* List */}
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
                  {/* Icon preview / upload */}
                  <button type="button" onClick={() => pickIcon(it.id)} title="Upload icon"
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-subtle)] bg-white text-neutral-400 hover:border-[var(--border-focus)]">
                    {busyId === it.id ? <SpinnerIcon size={12} className="animate-spin text-neutral-500" /> : it.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.icon_url} alt="" className="h-5 w-5 object-contain" />
                    ) : <UploadIcon size={12} />}
                  </button>

                  {/* Name (click to drill, except while editing) */}
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

                  {/* Row actions (hover) */}
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <IconBtn title="Move up" disabled={idx === 0 || !!q} onClick={() => move(it.id, -1)}><ArrowUpIcon size={11} /></IconBtn>
                    <IconBtn title="Move down" disabled={idx === filtered.length - 1 || !!q} onClick={() => move(it.id, 1)}><ArrowDownIcon size={11} /></IconBtn>
                    <IconBtn title="Rename" onClick={() => { setEditId(it.id); setEditName(it.name); }}><PencilIcon size={11} /></IconBtn>
                    <IconBtn title="Delete" tone="rose" onClick={() => remove(it.id)}><TrashIcon size={11} /></IconBtn>
                  </div>

                  {level.key !== "types" && !isEditing && (
                    <span className={`shrink-0 text-[var(--text-dim)] ${active ? "text-[var(--accent)]" : "opacity-40 group-hover:opacity-100"}`}>›</span>
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

function IconBtn({ children, title, onClick, disabled, tone }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; tone?: "rose" }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-dim)] hover:bg-[var(--bg-card)] disabled:opacity-25 disabled:hover:bg-transparent ${tone === "rose" ? "hover:text-rose-400" : "hover:text-[var(--text-primary)]"}`}>
      {children}
    </button>
  );
}
