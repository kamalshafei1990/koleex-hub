"use client";

/* ---------------------------------------------------------------------------
   VisualAssetPicker — a modal that lets an admin pick an icon/photo from the
   existing Visual Library (the 5,000+ governed assets) and bind it to a
   template field or value. Kamal always chooses the asset here; nothing is
   auto-generated. Returns the picked asset (with its public URL) or null to
   clear the current assignment.
   --------------------------------------------------------------------------- */

import { useEffect, useState, useCallback } from "react";

export interface PickedAsset {
  id: string;
  title: string;
  public_url: string;
}

export default function VisualAssetPicker({
  open,
  title = "Choose a visual",
  onPick,
  onClose,
}: {
  open: boolean;
  title?: string;
  onPick: (asset: PickedAsset | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [assets, setAssets] = useState<PickedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "60", sort: "name" });
      if (query) params.set("q", query);
      const res = await fetch(`/api/visual-library?${params.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { assets?: Array<Record<string, unknown>>; total?: number };
      const rows = (data.assets ?? [])
        .map((r) => ({
          id: String(r.id ?? ""),
          title: String(r.title ?? r.code ?? "Untitled"),
          public_url: (r.public_url as string | null) ?? "",
        }))
        .filter((r) => r.id && r.public_url);
      setAssets(rows);
      setTotal(data.total ?? rows.length);
    } catch {
      setAssets([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load(debounced);
  }, [open, debounced, load]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[82vh] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <p className="text-[14px] font-bold text-[var(--text-primary)] flex-1">{title}</p>
          <button
            onClick={() => onPick(null)}
            className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-1 rounded-md"
          >
            Clear
          </button>
          <button
            onClick={onClose}
            className="h-7 w-7 grid place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the Visual Library…"
            className="w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
          />
          <p className="text-[11px] text-[var(--text-dim)] mt-1.5">
            {loading ? "Searching…" : `${total} asset${total === 1 ? "" : "s"}`}
          </p>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {assets.length === 0 && !loading ? (
            <div className="h-40 grid place-items-center text-[13px] text-[var(--text-dim)]">
              No assets found — try another search.
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {assets.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onPick(a)}
                  title={a.title}
                  className="group aspect-square rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 flex items-center justify-center hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.public_url} alt={a.title} loading="lazy" className="max-h-full max-w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
