"use client";

/* ---------------------------------------------------------------------------
   VisualLibraryUploadModal — upload a single visual asset.

   Flow: pick file → uploadToStorage('media', visual-library/{category}/{file})
   → POST governed metadata to /api/visual-library. SVGs are normalized
   client-side (inject fill=currentColor, strip width/height) before upload so
   they theme correctly in dark mode.
   --------------------------------------------------------------------------- */

import { useState, type ChangeEvent } from "react";
import { uploadToStorage } from "@/lib/storage-client";
import { ASSET_TYPES, ASSET_CATEGORIES } from "@/lib/visual-library/types";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/** Normalize an SVG string so it inherits color + scales to its container. */
function normalizeSvg(raw: string): string {
  let s = raw.replace(/<\?xml[^>]*\?>/i, "").trim();
  // strip width/height on the root <svg>
  s = s.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, "$1").replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, "$1");
  // ensure fill=currentColor on the root so all paths inherit it
  if (!/<svg\b[^>]*\sfill=/i.test(s)) {
    s = s.replace(/<svg\b/i, '<svg fill="currentColor"');
  }
  return s;
}

const INPUT = "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-1";

export default function VisualLibraryUploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [assetType, setAssetType] = useState<string>("icon");
  const [category, setCategory] = useState<string>("General");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim());
  };

  const submit = async () => {
    if (!file) { setError("Please choose a file."); return; }
    if (!title.trim()) { setError("Please enter a title."); return; }
    setBusy(true); setError(null);
    try {
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
      const isSvg = ext === "svg" || file.type === "image/svg+xml";
      const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "asset";
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `visual-library/${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${slug}-${rand}.${ext}`;

      let uploadBlob: Blob = file;
      let viewbox: string | null = null;
      if (isSvg) {
        const raw = await file.text();
        const m = raw.match(/viewBox="([^"]+)"/i);
        viewbox = m ? m[1] : null;
        uploadBlob = new Blob([normalizeSvg(raw)], { type: "image/svg+xml" });
      }

      const up = await uploadToStorage("media", path, uploadBlob, { upsert: true, contentType: isSvg ? "image/svg+xml" : file.type });
      if (!up.ok) { setError(up.error); setBusy(false); return; }

      const res = await fetch("/api/visual-library", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          asset_type: assetType,
          category,
          source_name: file.name.replace(/\.[a-z0-9]+$/i, ""),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          file_type: ext,
          storage_bucket: "media",
          svg_path: up.data.path,
          viewbox,
          file_size: file.size,
          mime_type: isSvg ? "image/svg+xml" : file.type,
          source: "upload",
          style: "outline",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "Save failed"); setBusy(false); return;
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Upload visual asset</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <CrossIcon size={16} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <span className={LABEL}>File (SVG, PNG, JPG)</span>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-3 text-[13px] text-[var(--text-muted)] hover:border-[var(--border-focus)]">
              <UploadIcon size={16} className="text-[var(--text-dim)]" />
              <span className="truncate">{file ? file.name : "Choose a file…"}</span>
              <input type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/*" className="hidden" onChange={onFile} />
            </label>
          </div>

          <div>
            <span className={LABEL}>Title</span>
            <input className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Auto thread trimmer" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={LABEL}>Type</span>
              <select className={INPUT} value={assetType} onChange={(e) => setAssetType(e.target.value)}>
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div>
              <span className={LABEL}>Category</span>
              <select className={INPUT} value={category} onChange={(e) => setCategory(e.target.value)}>
                {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className={LABEL}>Tags (comma separated)</span>
            <input className={INPUT} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="thread, trimmer, automation" />
          </div>

          {error && <p className="text-[12px] text-rose-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50"
          >
            {busy && <SpinnerIcon size={14} className="animate-spin" />}
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
