"use client";

/* ---------------------------------------------------------------------------
   CollectionDetail — hero + member asset grid (drag-reorder / remove / open) +
   inline add-assets search + collection intelligence (computed, no AI).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  COLLECTION_TYPE_LABEL, type VisualCollection, type CollectionAsset, type CollectionType, type VisualAsset,
} from "@/lib/visual-library/types";
import VisualAssetDetailDrawer from "@/components/database/VisualAssetDetailDrawer";
import CollectionModal from "@/components/database/CollectionModal";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";

interface Intel {
  total: number; total_usage: number;
  styles: { value: string; count: number }[];
  categories: { value: string; count: number }[];
  meanings: { value: string; count: number }[];
  duplicate_concepts: { value: string; count: number }[];
}

export default function CollectionDetail({ cid }: { cid: string }) {
  const router = useRouter();
  const [col, setCol] = useState<VisualCollection | null>(null);
  const [intel, setIntel] = useState<Intel | null>(null);
  const [items, setItems] = useState<CollectionAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAsset, setOpenAsset] = useState<VisualAsset | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/visual-library/collections/${cid}`, { credentials: "include", cache: "no-store" });
    if (!res.ok) { setCol(null); return; }
    const j = await res.json();
    setCol(j.collection); setIntel(j.intelligence);
  }, [cid]);
  const loadAssets = useCallback(async () => {
    const res = await fetch(`/api/visual-library/collections/${cid}/assets?pageSize=200`, { credentials: "include", cache: "no-store" });
    const j = res.ok ? await res.json() : { items: [] };
    setItems(j.items ?? []);
  }, [cid]);
  useEffect(() => { (async () => { setLoading(true); await Promise.all([loadMeta(), loadAssets()]); setLoading(false); })(); }, [loadMeta, loadAssets]);

  const colAction = async (body: Record<string, unknown>) => {
    setBusy(true);
    await fetch(`/api/visual-library/collections/${cid}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false); loadMeta();
  };
  const removeAsset = async (linkId: string) => {
    await fetch(`/api/visual-library/collections/${cid}/assets?link_id=${linkId}`, { method: "DELETE", credentials: "include" });
    loadAssets(); loadMeta();
  };
  const del = async () => {
    if (!confirm("Delete this collection? Assets stay in the library.")) return;
    await fetch(`/api/visual-library/collections/${cid}`, { method: "DELETE", credentials: "include" });
    router.push("/database/collections");
  };

  // Drag reorder
  const onDrop = async (toIdx: number) => {
    const from = dragIdx.current; dragIdx.current = null;
    if (from === null || from === toIdx) return;
    const next = [...items]; const [moved] = next.splice(from, 1); next.splice(toIdx, 0, moved);
    setItems(next);
    await fetch(`/api/visual-library/collections/${cid}/assets`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((i) => i.id) }),
    });
  };

  if (loading) return <div className="flex justify-center py-20 text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;
  if (!col) return (
    <div className="py-16 text-center">
      <p className="text-[14px] text-[var(--text-muted)]">Collection not found.</p>
      <Link href="/database/collections" className="mt-2 inline-block text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">← Back to collections</Link>
    </div>
  );

  const isApproved = col.approval_status === "approved";
  const isArchived = col.approval_status === "archived";

  return (
    <div className="space-y-5">
      <Link href="/database/collections" className="inline-flex items-center gap-1 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]"><ArrowLeftIcon size={12} /> Collections</Link>

      {/* Hero */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">{col.name}</h1>
              {col.code && <span className="rounded-md bg-[var(--bg-surface-hover)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-dim)]">{col.code}</span>}
            </div>
            {col.description && <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--text-muted)]">{col.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--text-dim)]">
              <Tag>{COLLECTION_TYPE_LABEL[col.collection_type as CollectionType]}</Tag>
              {col.category && <Tag>{col.category}</Tag>}
              {col.style_type && <Tag>{col.style_type.replace(/_/g, " ")}</Tag>}
              <Tag>{items.length} assets</Tag>
              {intel && <Tag>{intel.total_usage} uses</Tag>}
              <Tag>{col.approval_status.replace(/_/g, " ")}</Tag>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowEdit(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><PencilIcon size={12} /> Edit</button>
            {!isApproved
              ? <button type="button" disabled={busy} onClick={() => colAction({ action: "approve" })} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50"><BadgeCheckIcon size={12} /> Approve</button>
              : <button type="button" disabled={busy} onClick={() => colAction({ action: "restore" })} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">Unapprove</button>}
            {!isArchived
              ? <button type="button" disabled={busy} onClick={() => colAction({ action: "archive" })} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"><ArchiveIcon size={12} /> Archive</button>
              : <button type="button" disabled={busy} onClick={() => colAction({ action: "restore" })} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">Restore</button>}
            <button type="button" onClick={del} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[12px] font-medium text-[var(--text-dim)] hover:text-rose-400"><TrashIcon size={12} /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
        {/* Asset grid + add */}
        <div className="space-y-3">
          <AddAssets cid={cid} existing={new Set(items.map((i) => i.asset_id))} onAdded={() => { loadAssets(); loadMeta(); }} />
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-12 text-center text-[12.5px] text-[var(--text-muted)]">No assets yet — search above to add some.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((it, idx) => (
                <div key={it.id} draggable onDragStart={() => { dragIdx.current = idx; }} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(idx)}
                  className="group relative flex cursor-grab flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] active:cursor-grabbing">
                  <button type="button" onClick={() => it.asset && setOpenAsset(it.asset as VisualAsset)} className="flex aspect-square items-center justify-center bg-white p-3 text-neutral-900">
                    {it.asset?.public_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.asset.public_url} alt={it.asset.title} className="h-full w-full object-contain" loading="lazy" />
                    ) : <span className="text-[9px] uppercase text-neutral-400">no icon</span>}
                  </button>
                  <div className="flex items-center justify-between gap-1 border-t border-[var(--border-subtle)] px-2 py-1.5">
                    <span className="truncate text-[10.5px] text-[var(--text-muted)]">{it.asset?.title ?? "—"}</span>
                    <button type="button" onClick={() => removeAsset(it.id)} title="Remove" className="shrink-0 text-[var(--text-dim)] opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"><TrashIcon size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Intelligence */}
        <aside className="space-y-3">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Collection intelligence</h3>
            <IntelBlock label="Dominant style" rows={intel?.styles} fmt={(v) => v.replace(/_/g, " ")} />
            <IntelBlock label="Categories" rows={intel?.categories} />
            <IntelBlock label="Common meanings" rows={intel?.meanings} />
            <IntelBlock label="Duplicate concepts" rows={intel?.duplicate_concepts} empty="None detected" />
          </div>
        </aside>
      </div>

      {openAsset && <VisualAssetDetailDrawer asset={openAsset} onClose={() => setOpenAsset(null)} onChanged={() => { loadAssets(); loadMeta(); }} />}
      {showEdit && <CollectionModal existing={col} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); loadMeta(); }} />}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 capitalize">{children}</span>;
}

function IntelBlock({ label, rows, fmt, empty }: { label: string; rows?: { value: string; count: number }[]; fmt?: (v: string) => string; empty?: string }) {
  return (
    <div className="border-t border-[var(--border-subtle)] py-2 first:border-t-0 first:pt-0">
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
      {!rows || rows.length === 0 ? (
        <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{empty ?? "—"}</p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <span key={r.value} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
              <span className="capitalize">{fmt ? fmt(r.value) : r.value}</span>
              <span className="tabular-nums text-[var(--text-dim)]">{r.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AddAssets({ cid, existing, onAdded }: { cid: string; existing: Set<string>; onAdded: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<VisualAsset[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const deb = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (deb.current) clearTimeout(deb.current);
    if (!q.trim()) { setResults([]); return; }
    deb.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/visual-library?q=${encodeURIComponent(q.trim())}&pageSize=24&sort=name`, { credentials: "include", cache: "no-store" });
      const j = res.ok ? await res.json() : { assets: [] };
      setResults((j.assets ?? []).filter((a: VisualAsset) => !existing.has(a.id)));
      setSearching(false);
    }, 250);
    return () => { if (deb.current) clearTimeout(deb.current); };
  }, [q, existing]);

  const add = async (id: string) => {
    setAdding(id);
    await fetch(`/api/visual-library/collections/${cid}/assets`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset_id: id }),
    });
    setAdding(null); setResults((r) => r.filter((x) => x.id !== id)); onAdded();
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 focus-within:border-[var(--border-focus)]">
        <PlusIcon size={13} className="shrink-0 text-[var(--text-dim)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the library to add assets…" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[var(--text-dim)]" />
        {searching && <SpinnerIcon size={13} className="animate-spin text-[var(--text-dim)]" />}
      </div>
      {results.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {results.map((a) => (
            <button key={a.id} type="button" disabled={adding === a.id} onClick={() => add(a.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] py-1 pl-1 pr-2.5 text-[11.5px] text-[var(--text-primary)] hover:border-[var(--border-color)] disabled:opacity-50">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                {a.public_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.public_url} alt="" className="h-3.5 w-3.5 object-contain" />
                ) : null}
              </span>
              {a.title}
              {adding === a.id ? <SpinnerIcon size={10} className="animate-spin" /> : <PlusIcon size={10} className="text-[var(--text-dim)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
