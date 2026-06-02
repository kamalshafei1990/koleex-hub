"use client";

/* Create / edit a visual collection. */

import { useState } from "react";
import {
  COLLECTION_TYPES, COLLECTION_TYPE_LABEL, COLLECTION_CATEGORIES, COLLECTION_STYLES,
  type VisualCollection,
} from "@/lib/visual-library/types";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const INPUT = "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]";

export default function CollectionModal({
  existing, onClose, onSaved,
}: { existing?: VisualCollection; onClose: () => void; onSaved: (id?: string) => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState(existing?.category ?? "Core System");
  const [type, setType] = useState(existing?.collection_type ?? "icon_pack");
  const [style, setStyle] = useState(existing?.style_type ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError(null);
    const payload = { name: name.trim(), description: description.trim() || null, category, collection_type: type, style_type: style || null };
    const url = existing ? `/api/visual-library/collections/${existing.id}` : "/api/visual-library/collections";
    const res = await fetch(url, {
      method: existing ? "PATCH" : "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError((j as { error?: string }).error ?? "Save failed"); setSaving(false); return; }
    const j = await res.json().catch(() => ({}));
    onSaved(j.id);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">{existing ? "Edit collection" : "New collection"}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={16} /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div><span className={LABEL}>Name</span><input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. KOLEEX Core UI" /></div>
          <div><span className={LABEL}>Description</span><textarea className={INPUT + " resize-none"} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this system is for…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><span className={LABEL}>Group</span>
              <select className={INPUT} value={category} onChange={(e) => setCategory(e.target.value)}>
                {COLLECTION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><span className={LABEL}>Type</span>
              <select className={INPUT} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                {COLLECTION_TYPES.map((t) => <option key={t} value={t}>{COLLECTION_TYPE_LABEL[t]}</option>)}
              </select>
            </div>
          </div>
          <div><span className={LABEL}>Style</span>
            <select className={INPUT} value={style} onChange={(e) => setStyle(e.target.value)}>
              <option value="">—</option>
              {COLLECTION_STYLES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          {error && <p className="text-[12px] text-rose-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
          <button type="button" onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
            {saving && <SpinnerIcon size={14} className="animate-spin" />}{existing ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
