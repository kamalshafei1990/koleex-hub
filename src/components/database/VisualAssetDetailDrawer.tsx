"use client";

/* ---------------------------------------------------------------------------
   VisualAssetDetailDrawer — right-side slide-over: preview, full registry
   metadata, attach/replace the icon file (for "Missing" entities), usage,
   version, linked systems, and the approval workflow.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { VisualAsset } from "@/lib/visual-library/types";
import { displayState } from "@/lib/visual-library/types";
import { uploadToStorage } from "@/lib/storage-client";
import { STATE_PILL } from "@/components/database/VisualAssetCard";
import SemanticRelationships from "@/components/database/SemanticRelationships";
import AddToCollectionModal from "@/components/database/AddToCollectionModal";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";

function normalizeSvg(raw: string): string {
  let s = raw.replace(/<\?xml[^>]*\?>/i, "").trim();
  s = s.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, "$1").replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, "$1");
  if (!/<svg\b[^>]*\sfill=/i.test(s)) s = s.replace(/<svg\b/i, '<svg fill="currentColor"');
  return s;
}

async function patch(id: string, body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/visual-library/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

/** Download the original SVG file. */
async function downloadSvg(url: string, name: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  triggerDownload(obj, `${name}.svg`);
  setTimeout(() => URL.revokeObjectURL(obj), 1000);
}

/** Rasterize the SVG to PNG/JPG at a given pixel size, client-side. */
async function downloadRaster(url: string, name: string, ext: "png" | "jpg", size: number) {
  const res = await fetch(url);
  let svg = await res.text();
  // Give the SVG an explicit pixel size so the browser rasterizes it crisply.
  svg = svg.replace(/<svg\b/i, `<svg width="${size}" height="${size}"`);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = svgUrl; });
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (ext === "jpg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size); }
    ctx.drawImage(img, 0, 0, size, size);
    await new Promise<void>((resolve) => canvas.toBlob((b) => {
      if (b) { const obj = URL.createObjectURL(b); triggerDownload(obj, `${name}.${ext}`); setTimeout(() => URL.revokeObjectURL(obj), 1000); }
      resolve();
    }, ext === "jpg" ? "image/jpeg" : "image/png", 0.92));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function AiField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <label className="block py-1.5">
      <span className="mb-1 block text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={1}
        className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
    </label>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
      <span className="text-right text-[12.5px] text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] text-[var(--text-muted)]">{t}</span>
      ))}
    </div>
  );
}

export default function VisualAssetDetailDrawer({
  asset, onClose, onChanged, onOpenAsset,
}: { asset: VisualAsset; onClose: () => void; onChanged: () => void; onOpenAsset?: (id: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [dlSize, setDlSize] = useState(256);
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // AI-preparation fields (schema ready; manual now, AI later).
  const [ai, setAi] = useState({ semantic_meaning: "", visual_style_description: "", ai_prompt_description: "" });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDirty, setAiDirty] = useState(false);
  useEffect(() => {
    setAi({
      semantic_meaning: asset.semantic_meaning ?? "",
      visual_style_description: asset.visual_style_description ?? "",
      ai_prompt_description: asset.ai_prompt_description ?? "",
    });
    setAiDirty(false);
  }, [asset.id, asset.semantic_meaning, asset.visual_style_description, asset.ai_prompt_description]);
  const saveAi = async () => {
    setAiBusy(true);
    const ok = await patch(asset.id, ai);
    setAiBusy(false);
    if (ok) { setAiDirty(false); onChanged(); }
  };
  // Collection memberships
  const [memberships, setMemberships] = useState<{ link_id: string; collection_id: string; name: string; slug: string | null }[]>([]);
  const [showAddCol, setShowAddCol] = useState(false);
  const loadMemberships = async () => {
    const res = await fetch(`/api/visual-library/${asset.id}/collections`, { credentials: "include", cache: "no-store" });
    const j = res.ok ? await res.json() : { memberships: [] };
    setMemberships(j.memberships ?? []);
  };
  useEffect(() => { loadMemberships(); }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const state = displayState(asset);
  const isApproved = asset.approval_status === "approved";
  const isArchived = asset.status === "archived";

  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    const ok = await patch(asset.id, body);
    setBusy(null);
    if (ok) onChanged();
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy("attach");
    try {
      const ext = (f.name.split(".").pop() ?? "bin").toLowerCase();
      const isSvg = ext === "svg" || f.type === "image/svg+xml";
      let blob: Blob = f; let viewbox: string | null = null;
      if (isSvg) {
        const raw = await f.text();
        viewbox = (raw.match(/viewBox="([^"]+)"/i) ?? [])[1] ?? null;
        blob = new Blob([normalizeSvg(raw)], { type: "image/svg+xml" });
      }
      const path = `visual-library/${asset.category ?? "misc"}/${asset.slug ?? asset.id}.${ext}`;
      const up = await uploadToStorage("media", path, blob, { upsert: true, contentType: isSvg ? "image/svg+xml" : f.type });
      if (up.ok) {
        await patch(asset.id, { svg_path: up.data.path, file_type: ext, storage_bucket: "media", viewbox, file_size: f.size, mime_type: isSvg ? "image/svg+xml" : f.type });
        onChanged();
      }
    } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-card)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{asset.title}</h3>
            <span className="font-mono text-[10.5px] text-[var(--text-dim)]">{asset.visual_asset_code}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Preview / attach */}
          <div className="relative flex aspect-video w-full items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-white p-8 text-neutral-900">
            {asset.public_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.public_url} alt={asset.title} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-neutral-400">
                <ImageRawIcon size={32} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Missing — no icon yet</span>
              </span>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/*" className="hidden" onChange={onFile} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === "attach"}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-primary)] disabled:opacity-50">
            {busy === "attach" ? <SpinnerIcon size={13} className="animate-spin" /> : <UploadIcon size={13} />}
            {asset.public_url ? "Replace icon" : "Upload icon for this entity"}
          </button>

          <div className="mt-3">
            <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATE_PILL[state] ?? STATE_PILL.draft}`}>{state}</span>
          </div>

          {/* Download */}
          {asset.public_url && (
            <div className="mt-4 rounded-xl border border-[var(--border-subtle)] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Download</span>
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
                  Size
                  <select value={dlSize} onChange={(e) => setDlSize(Number(e.target.value))}
                    className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-1 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
                    {[64, 128, 256, 512, 1024].map((s) => <option key={s} value={s}>{s}px</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {([
                  { key: "svg", label: "SVG", fn: () => downloadSvg(asset.public_url!, asset.slug ?? asset.id), note: "vector" },
                  { key: "png", label: "PNG", fn: () => downloadRaster(asset.public_url!, asset.slug ?? asset.id, "png", dlSize), note: "transparent" },
                  { key: "jpg", label: "JPG", fn: () => downloadRaster(asset.public_url!, asset.slug ?? asset.id, "jpg", dlSize), note: "white bg" },
                ] as const).map((opt) => (
                  <button key={opt.key} type="button" disabled={!!dlBusy}
                    onClick={async () => { setDlBusy(opt.key); try { await opt.fn(); patch(asset.id, { action: "use" }); } finally { setDlBusy(null); } }}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-2 text-[12px] font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50">
                    {dlBusy === opt.key ? <SpinnerIcon size={14} className="animate-spin" /> : <span>{opt.label}</span>}
                    <span className="text-[9px] font-normal text-[var(--text-dim)]">{opt.note}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 divide-y divide-[var(--border-subtle)]">
            <Row label="Slug" value={<span className="font-mono text-[11.5px]">{asset.slug}</span>} />
            <Row label="Type" value={asset.asset_type.replace(/_/g, " ")} />
            <Row label="Category" value={[asset.category, asset.subcategory].filter(Boolean).join(" · ") || "—"} />
            <Row label="Style" value={asset.style ?? "—"} />
            <Row label="Version" value={`v${asset.version}`} />
            <Row label="Used" value={`${asset.usage_count}×`} />
            <Row label="Source" value={asset.source ?? "—"} />
            {asset.description && <Row label="Description" value={asset.description} />}
          </div>

          {(asset.keywords?.length > 0) && (
            <div className="py-3"><span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Keywords</span><Chips items={asset.keywords} /></div>
          )}
          {(asset.synonyms?.length > 0) && (
            <div className="py-1"><span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Synonyms</span><Chips items={asset.synonyms} /></div>
          )}
          {(asset.search_aliases?.length > 0) && (
            <div className="py-1"><span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Search aliases</span><Chips items={asset.search_aliases} /></div>
          )}
          {(asset.linked_modules?.length > 0) && (
            <div className="py-1"><span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Linked modules</span><Chips items={asset.linked_modules} /></div>
          )}
          {(asset.linked_apps?.length > 0) && (
            <div className="py-1"><span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Linked apps</span><Chips items={asset.linked_apps} /></div>
          )}

          {/* Intelligence (AI-prep) */}
          <div className="mt-4 rounded-xl border border-[var(--border-subtle)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Intelligence</span>
              {aiDirty && (
                <button type="button" onClick={saveAi} disabled={aiBusy}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-inverted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
                  {aiBusy ? <SpinnerIcon size={11} className="animate-spin" /> : null} Save
                </button>
              )}
            </div>
            <AiField label="Semantic meaning" placeholder="e.g. Represents backward navigation"
              value={ai.semantic_meaning} onChange={(v) => { setAi((s) => ({ ...s, semantic_meaning: v })); setAiDirty(true); }} />
            <AiField label="Visual style" placeholder="e.g. Minimal monochrome rounded outline icon"
              value={ai.visual_style_description} onChange={(v) => { setAi((s) => ({ ...s, visual_style_description: v })); setAiDirty(true); }} />
            <AiField label="AI prompt" placeholder="e.g. Apple-style rounded outline navigation arrow"
              value={ai.ai_prompt_description} onChange={(v) => { setAi((s) => ({ ...s, ai_prompt_description: v })); setAiDirty(true); }} />
          </div>

          {/* Collections */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Collections{memberships.length > 0 ? ` · ${memberships.length}` : ""}
              </span>
              <button type="button" onClick={() => setShowAddCol(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]">
                <LayersIcon size={12} /> Add
              </button>
            </div>
            {memberships.length === 0 ? (
              <p className="text-[11.5px] text-[var(--text-dim)]">Not in any collection yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {memberships.map((m) => (
                  <a key={m.link_id} href={m.slug ? `/database/collections/${m.slug}` : "#"}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11.5px] text-[var(--text-primary)] hover:border-[var(--border-color)]">
                    <LayersIcon size={11} className="text-[var(--text-dim)]" /> {m.name}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Semantic relationships */}
          <SemanticRelationships asset={{ id: asset.id, title: asset.title }} onOpenAsset={onOpenAsset} />

          <div className="mt-4 divide-y divide-[var(--border-subtle)] text-[var(--text-dim)]">
            <Row label="Created" value={asset.created_at ? new Date(asset.created_at).toLocaleDateString() : "—"} />
            {asset.approved_at && <Row label="Approved" value={new Date(asset.approved_at).toLocaleDateString()} />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
          {!isApproved ? (
            <button type="button" disabled={!!busy || !asset.svg_path} onClick={() => run("approve", { action: "approve" })}
              title={!asset.svg_path ? "Upload an icon before approving" : ""}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-40">
              {busy === "approve" ? <SpinnerIcon size={13} className="animate-spin" /> : <BadgeCheckIcon size={13} />} Approve
            </button>
          ) : (
            <button type="button" disabled={!!busy} onClick={() => run("unapprove", { action: "unapprove" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">Un-approve</button>
          )}
          {!isArchived ? (
            <button type="button" disabled={!!busy} onClick={() => run("archive", { action: "archive" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
              {busy === "archive" ? <SpinnerIcon size={13} className="animate-spin" /> : <ArchiveIcon size={13} />} Archive
            </button>
          ) : (
            <button type="button" disabled={!!busy} onClick={() => run("restore", { action: "restore" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">Restore</button>
          )}
          {asset.public_url && (
            <a href={asset.public_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">Open file ↗</a>
          )}
        </div>
      </div>

      {showAddCol && (
        <AddToCollectionModal assetIds={[asset.id]} onClose={() => setShowAddCol(false)} onDone={() => { setShowAddCol(false); loadMemberships(); }} />
      )}
    </div>
  );
}
