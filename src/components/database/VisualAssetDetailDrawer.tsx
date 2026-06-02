"use client";

/* ---------------------------------------------------------------------------
   VisualAssetDetailDrawer — right-side slide-over: preview, full registry
   metadata, attach/replace the icon file (for "Missing" entities), usage,
   version, linked systems, and the approval workflow.
   --------------------------------------------------------------------------- */

import { useRef, useState, type ChangeEvent } from "react";
import type { VisualAsset } from "@/lib/visual-library/types";
import { displayState } from "@/lib/visual-library/types";
import { uploadToStorage } from "@/lib/storage-client";
import { STATE_PILL } from "@/components/database/VisualAssetCard";
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
  asset, onClose, onChanged,
}: { asset: VisualAsset; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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

          <div className="mt-2 divide-y divide-[var(--border-subtle)] text-[var(--text-dim)]">
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
    </div>
  );
}
