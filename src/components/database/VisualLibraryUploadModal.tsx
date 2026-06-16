"use client";

/* ---------------------------------------------------------------------------
   VisualLibraryUploadModal — register a visual entity.

   Works two ways:
   · Upload a file now (drag/drop or pick) → normalized SVG → Storage → record.
   · Or register a "Missing" entity with NO file (leave the file empty) — the
     icon can be uploaded into the record later.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import { uploadToStorage } from "@/lib/storage-client";
import { ASSET_TYPES } from "@/lib/visual-library/types";
import { GENERAL_ICON_CATEGORIES, CATEGORY_BY_KEY, fetchIconCategories, type FetchedIconCategory } from "@/lib/visual-library/taxonomy";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

function normalizeSvg(raw: string): string {
  let s = raw.replace(/<\?xml[^>]*\?>/i, "").trim();
  s = s.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, "$1").replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, "$1");
  if (!/<svg\b[^>]*\sfill=/i.test(s)) s = s.replace(/<svg\b/i, '<svg fill="currentColor"');
  return s;
}

const INPUT = "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-1";

export default function VisualLibraryUploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: (assetId?: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [assetType, setAssetType] = useState("icon");
  const [category, setCategory] = useState("misc");
  const [subcategory, setSubcategory] = useState("");
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subcats = useMemo(() => CATEGORY_BY_KEY[category]?.subcategories ?? [], [category]);
  const [categories, setCategories] = useState<FetchedIconCategory[]>(
    GENERAL_ICON_CATEGORIES.map((c) => ({ key: c.key, label: c.label, code: c.code })),
  );
  useEffect(() => { fetchIconCategories().then(setCategories).catch(() => {}); }, []);

  const takeFile = (f: File | null) => {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim());
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => takeFile(e.target.files?.[0] ?? null);
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0] ?? null); };

  const submit = async () => {
    if (!title.trim()) { setError("Please enter a name."); return; }
    setBusy(true); setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(), asset_type: assetType, category, subcategory: subcategory || null,
        keywords: keywords.split(",").map((t) => t.trim()).filter(Boolean),
        tags: keywords.split(",").map((t) => t.trim()).filter(Boolean),
        source: "upload", style: "outline",
      };

      if (file) {
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
        const isSvg = ext === "svg" || file.type === "image/svg+xml";
        const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `visual-library/${category}/${slug}-${rand}.${ext}`;
        let blob: Blob = file; let viewbox: string | null = null;
        if (isSvg) {
          const raw = await file.text();
          viewbox = (raw.match(/viewBox="([^"]+)"/i) ?? [])[1] ?? null;
          blob = new Blob([normalizeSvg(raw)], { type: "image/svg+xml" });
        }
        const up = await uploadToStorage("media", path, blob, { upsert: true, contentType: isSvg ? "image/svg+xml" : file.type });
        if (!up.ok) { setError(up.error); setBusy(false); return; }
        Object.assign(payload, {
          source_name: file.name.replace(/\.[a-z0-9]+$/i, ""), file_type: ext, storage_bucket: "media",
          svg_path: up.data.path, viewbox, file_size: file.size, mime_type: isSvg ? "image/svg+xml" : file.type,
        });
      }

      const res = await fetch("/api/visual-library", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((j as { error?: string }).error ?? "Save failed"); setBusy(false); return;
      }
      onUploaded((j as { id?: string }).id ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed"); setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">New visual entity</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={16} /></button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <span className={LABEL}>Icon file <span className="font-normal normal-case text-[var(--text-dim)]">— optional, can add later</span></span>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 py-5 text-center text-[12.5px] transition-colors ${
                dragging ? "border-[var(--accent)] bg-[var(--bg-surface-hover)]" : "border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)]"
              }`}>
              <UploadIcon size={18} className="text-[var(--text-dim)]" />
              <span className="text-[var(--text-muted)]">{file ? file.name : "Drag & drop, or click to choose (SVG/PNG/JPG)"}</span>
              <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/*" className="hidden" onChange={onPick} />
            </label>
          </div>

          <div><span className={LABEL}>Name</span><input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Search" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><span className={LABEL}>Type</span>
              <select className={INPUT} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><span className={LABEL}>Category</span>
              <select className={INPUT} value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}>
                {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><span className={LABEL}>Subcategory</span>
              <select className={INPUT} value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                <option value="">—</option>
                {subcats.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><span className={LABEL}>Keywords</span><input className={INPUT} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="find, lookup" /></div>
          </div>

          {error && <p className="text-[12px] text-rose-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
          <button type="button" onClick={submit} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
            {busy && <SpinnerIcon size={14} className="animate-spin" />}
            {busy ? "Saving…" : file ? "Upload & create" : "Create entity"}
          </button>
        </div>
      </div>
    </div>
  );
}
