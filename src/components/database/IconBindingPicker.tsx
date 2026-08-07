"use client";

/* ---------------------------------------------------------------------------
   IconBindingPicker — the ONE modal every control-center section uses to
   assign an icon to a meaning. Searches the General Icons library
   (/api/visual-library?view=list&q=) and writes the binding through
   /api/visual-bindings, which enforces the law: one icon = one meaning.
   A 409 shows WHO owns the icon instead of failing silently.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { invalidateIconBindings } from "@/lib/visual-bindings";

const MEDIA_BASE = "https://yxyizbnfjrwrnmwhkvme.supabase.co/storage/v1/object/public/media/";

interface AssetRow {
  id: string;
  title: string | null;
  svg_path: string | null;
  preview_path: string | null;
  category: string | null;
  public_url?: string | null;
}

export default function IconBindingPicker({
  semanticKey, domain, label, currentUrl, onClose, onSaved,
}: {
  semanticKey: string;
  domain: string;
  label: string;
  currentUrl?: string | null;
  onClose: () => void;
  onSaved: (url: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/visual-library?view=list&q=${encodeURIComponent(q)}&pageSize=60`, { credentials: "include" });
        const json = (await res.json().catch(() => null)) as { assets?: AssetRow[]; rows?: AssetRow[] } | null;
        const list = (json?.assets ?? json?.rows ?? []) as AssetRow[];
        setRows(list.filter((a) => a.svg_path));
      } catch { setRows([]); }
      setLoading(false);
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const save = async (url: string | null) => {
    setSaving(url ?? "__clear__");
    setErr(null);
    try {
      const res = await fetch("/api/visual-bindings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semantic_key: semanticKey, domain, icon_url: url, label_en: label }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) { setErr(json?.error || "Save failed"); setSaving(null); return; }
      invalidateIconBindings();
      onSaved(url);
      onClose();
    } catch {
      setErr("Network error"); setSaving(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Choose icon — {label}</h3>
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">One icon = one meaning. Icons already bound elsewhere will be refused with the owner named.</p>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the General Icons library…"
            className="mt-3 w-full h-10 px-4 rounded-xl bg-[var(--bg-surface-subtle)]/70 border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)]"
          />
          {err && <p className="mt-2 text-[12px] text-rose-400">{err}</p>}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-center text-[12px] text-[var(--text-ghost)] py-8">Searching…</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-[12px] text-[var(--text-ghost)] py-8">No icons matched.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              {rows.map((a) => {
                const url = (a.public_url || MEDIA_BASE + a.svg_path).replace(/\s+/g, "");
                const active = currentUrl === url;
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={saving !== null}
                    onClick={() => save(url)}
                    title={a.title ?? ""}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-colors ${active ? "border-[var(--text-primary)] bg-[var(--bg-surface)]" : "border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)]/60"} disabled:opacity-50`}
                  >
                    <span
                      aria-hidden
                      className="h-7 w-7 bg-current text-[var(--text-primary)]"
                      style={{ maskImage: `url("${url}")`, maskRepeat: "no-repeat", maskPosition: "center", maskSize: "contain", WebkitMaskImage: `url("${url}")`, WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", WebkitMaskSize: "contain" }}
                    />
                    <span className="text-[9.5px] leading-tight text-center text-[var(--text-muted)] line-clamp-2">{a.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => save(null)}
            disabled={saving !== null || !currentUrl}
            className="text-[12px] font-medium text-[var(--text-muted)] hover:text-rose-400 transition-colors disabled:opacity-40"
          >
            Remove binding (use default)
          </button>
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
