"use client";

/* ---------------------------------------------------------------------------
   CollectionsBrowser — the curated visual systems & icon packs browser.
   Card grid, search + category/type/status filters + sort, create modal.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  COLLECTION_TYPES, COLLECTION_TYPE_LABEL, COLLECTION_CATEGORIES, COLLECTION_STATES,
  type VisualCollection, type CollectionType,
} from "@/lib/visual-library/types";
import CollectionModal from "@/components/database/CollectionModal";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";

const SELECT = "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const STATE_PILL: Record<string, string> = {
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  draft: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  deprecated: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  archived: "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)]",
  internal_only: "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)]",
};

export default function CollectionsBrowser() {
  const [cols, setCols] = useState<VisualCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("updated");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort });
    if (category) params.set("category", category);
    if (type) params.set("collection_type", type);
    if (status) params.set("approval_status", status);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/visual-library/collections?${params}`, { credentials: "include", cache: "no-store" });
    const json = res.ok ? await res.json() : { collections: [] };
    setCols(json.collections ?? []);
    setLoading(false);
  }, [sort, category, type, status, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const grouped = useMemo(() => {
    const m: Record<string, VisualCollection[]> = {};
    for (const c of cols) { const k = c.category || "Other"; (m[k] ??= []).push(c); }
    return m;
  }, [cols]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3.5 py-2.5 focus-within:border-[var(--border-focus)]">
          <SearchIcon size={14} className="shrink-0 text-[var(--text-dim)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search collections…"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]" />
        </div>
        <button type="button" onClick={() => setShowCreate(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] hover:opacity-90">
          <PlusIcon size={14} /> New collection
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className={SELECT} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All groups</option>
          {COLLECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={SELECT} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {COLLECTION_TYPES.map((t) => <option key={t} value={t}>{COLLECTION_TYPE_LABEL[t]}</option>)}
        </select>
        <select className={SELECT} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All states</option>
          {COLLECTION_STATES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select className={SELECT} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">Recently updated</option>
          <option value="count">Most assets</option>
          <option value="name">Name</option>
        </select>
        <span className="ml-auto text-[12px] text-[var(--text-dim)] tabular-nums">{loading ? "…" : `${cols.length} collections`}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>
      ) : cols.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-16 text-center">
          <LayersIcon size={32} className="text-[var(--text-dim)]" />
          <p className="mt-3 text-[13px] font-medium text-[var(--text-muted)]">No collections yet</p>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">Create your first KOLEEX visual system or icon pack.</p>
        </div>
      ) : (sort === "updated" || sort === "count") ? (
        Object.entries(grouped).map(([group, items]) => (
          <div key={group}>
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{group}</h2>
            <Grid items={items} />
          </div>
        ))
      ) : (
        <Grid items={cols} />
      )}

      {showCreate && <CollectionModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function Grid({ items }: { items: VisualCollection[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((c) => <Card key={c.id} c={c} />)}
    </div>
  );
}

function Card({ c }: { c: VisualCollection }) {
  return (
    <Link href={`/database/collections/${c.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
      <div className="flex aspect-[16/7] items-center justify-center border-b border-[var(--border-subtle)] bg-white">
        {c.cover_url || c.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(c.cover_url || c.icon_url)!} alt="" className="h-10 w-10 object-contain text-neutral-900" />
        ) : (
          <LayersIcon size={26} className="text-neutral-300" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-[13.5px] font-semibold text-[var(--text-primary)]">{c.name}</span>
          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${STATE_PILL[c.approval_status] ?? STATE_PILL.draft}`}>{c.approval_status.replace(/_/g, " ")}</span>
        </div>
        {c.description && <p className="line-clamp-2 text-[11.5px] leading-relaxed text-[var(--text-muted)]">{c.description}</p>}
        <div className="mt-auto flex items-center gap-2 pt-1.5 text-[11px] text-[var(--text-dim)]">
          <span className="inline-flex items-center gap-1"><ImageRawIcon size={11} /> {c.asset_count ?? 0}</span>
          <span>·</span>
          <span className="truncate">{COLLECTION_TYPE_LABEL[c.collection_type as CollectionType]}</span>
          {c.style_type && <><span>·</span><span className="truncate">{c.style_type.replace(/_/g, " ")}</span></>}
        </div>
      </div>
    </Link>
  );
}
