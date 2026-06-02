"use client";

/* ---------------------------------------------------------------------------
   Asset Workspace — the right-side slide-over for a single visual asset,
   organized as a tabbed, lazy-loaded workspace (Figma/Linear-grade) rather
   than one long form.

   Tabs: Overview · Intelligence · Governance · Collections · Relationships ·
         Usage · History. Only the active tab's panel is mounted, so heavy
         sub-panels (governance, relationships, history) fetch on demand.

   The component keeps the same export name + props so every call site
   (library browser, collection detail) works unchanged.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { VisualAsset, VisualAssetEvent } from "@/lib/visual-library/types";
import { displayState } from "@/lib/visual-library/types";
import { assetHealth } from "@/lib/visual-library/health";
import { uploadToStorage } from "@/lib/storage-client";
import { STATE_PILL } from "@/components/database/VisualAssetCard";
import SemanticRelationships from "@/components/database/SemanticRelationships";
import AddToCollectionModal from "@/components/database/AddToCollectionModal";
import UsageGovernance from "@/components/database/UsageGovernance";
import AssetQuality from "@/components/database/AssetQuality";
import AssetDna from "@/components/database/AssetDna";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";

/* ── helpers ── */
function normalizeSvg(raw: string): string {
  let s = raw.replace(/<\?xml[^>]*\?>/i, "").trim();
  s = s.replace(/(<svg\b[^>]*?)\swidth="[^"]*"/i, "$1").replace(/(<svg\b[^>]*?)\sheight="[^"]*"/i, "$1");
  if (!/<svg\b[^>]*\sfill=/i.test(s)) s = s.replace(/<svg\b/i, '<svg fill="currentColor"');
  return s;
}
async function patch(id: string, body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`/api/visual-library/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.ok;
}
function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a"); a.href = href; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}
async function downloadSvg(url: string, name: string) {
  const blob = await (await fetch(url)).blob();
  const obj = URL.createObjectURL(blob); triggerDownload(obj, `${name}.svg`); setTimeout(() => URL.revokeObjectURL(obj), 1000);
}
async function downloadRaster(url: string, name: string, ext: "png" | "jpg", size: number) {
  let svg = await (await fetch(url)).text();
  svg = svg.replace(/<svg\b/i, `<svg width="${size}" height="${size}"`);
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = svgUrl; });
    const c = document.createElement("canvas"); c.width = size; c.height = size;
    const ctx = c.getContext("2d"); if (!ctx) return;
    if (ext === "jpg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size); }
    ctx.drawImage(img, 0, 0, size, size);
    await new Promise<void>((res) => c.toBlob((b) => { if (b) { const o = URL.createObjectURL(b); triggerDownload(o, `${name}.${ext}`); setTimeout(() => URL.revokeObjectURL(o), 1000); } res(); }, ext === "jpg" ? "image/jpeg" : "image/png", 0.92));
  } finally { URL.revokeObjectURL(svgUrl); }
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
      {items.map((t) => <span key={t} className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] text-[var(--text-muted)]">{t}</span>)}
    </div>
  );
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

const TABS = ["Overview", "Intelligence", "Governance", "Collections", "Relationships", "Usage", "History", "Quality", "DNA"] as const;
type Tab = (typeof TABS)[number];

export default function VisualAssetDetailDrawer({
  asset, onClose, onChanged, onOpenAsset,
}: { asset: VisualAsset; onClose: () => void; onChanged: () => void; onOpenAsset?: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // counts used by the health badge (cheap, fetched once when drawer opens)
  const [counts, setCounts] = useState({ rel: 0, col: 0, gov: 0 });
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/visual-library/${asset.id}/relationships`, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { relationships: [] }),
      fetch(`/api/visual-library/${asset.id}/collections`, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { memberships: [] }),
      fetch(`/api/visual-library/${asset.id}/governance`, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { rules: [] }),
    ]).then(([rel, col, gov]) => { if (alive) setCounts({ rel: (rel.relationships ?? []).length, col: (col.memberships ?? []).length, gov: (gov.rules ?? []).length }); }).catch(() => {});
    return () => { alive = false; };
  }, [asset.id]);

  const health = useMemo(() => assetHealth({
    asset, relationshipCount: counts.rel, collectionCount: counts.col, governanceRuleCount: counts.gov,
  }), [asset, counts]);
  const healthTone = health.tone === "positive" ? "text-emerald-400" : health.tone === "warning" ? "text-amber-400" : "text-rose-400";

  const isApproved = asset.approval_status === "approved";
  const isArchived = asset.status === "archived";
  const run = async (key: string, body: Record<string, unknown>) => { setBusy(key); const ok = await patch(asset.id, body); setBusy(null); if (ok) onChanged(); };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy("attach");
    try {
      const ext = (f.name.split(".").pop() ?? "bin").toLowerCase();
      const isSvg = ext === "svg" || f.type === "image/svg+xml";
      let blob: Blob = f; let viewbox: string | null = null;
      if (isSvg) { const raw = await f.text(); viewbox = (raw.match(/viewBox="([^"]+)"/i) ?? [])[1] ?? null; blob = new Blob([normalizeSvg(raw)], { type: "image/svg+xml" }); }
      const path = `visual-library/${asset.category ?? "misc"}/${asset.slug ?? asset.id}.${ext}`;
      const up = await uploadToStorage("media", path, blob, { upsert: true, contentType: isSvg ? "image/svg+xml" : f.type });
      if (up.ok) { await patch(asset.id, { svg_path: up.data.path, file_type: ext, storage_bucket: "media", viewbox, file_size: f.size, mime_type: isSvg ? "image/svg+xml" : f.type }); onChanged(); }
    } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-card)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-[var(--border-subtle)] px-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{asset.title}</h3>
              <span className="font-mono text-[10.5px] text-[var(--text-dim)]">{asset.visual_asset_code}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] font-semibold tabular-nums ${healthTone}`} title="Asset health score">
                ♥ {health.score}
              </span>
              <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={16} /></button>
            </div>
          </div>
          {/* Tab nav */}
          <nav className="-mx-1 mt-3 flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`relative shrink-0 whitespace-nowrap px-2.5 pb-2.5 pt-1 text-[12px] font-medium transition-colors ${tab === t ? "text-[var(--text-primary)]" : "text-[var(--text-dim)] hover:text-[var(--text-muted)]"}`}>
                {t}
                {tab === t && <span className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-[var(--text-primary)]" />}
              </button>
            ))}
          </nav>
        </div>

        {/* Panels (only active tab mounted → lazy) */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "Overview" && <OverviewTab asset={asset} busy={busy} fileRef={fileRef} onFile={onFile} onPickFile={() => fileRef.current?.click()} />}
          {tab === "Intelligence" && <IntelligenceTab asset={asset} onChanged={onChanged} />}
          {tab === "Governance" && <UsageGovernance entityType="asset" entityId={asset.id} />}
          {tab === "Collections" && <CollectionsTab assetId={asset.id} />}
          {tab === "Relationships" && <SemanticRelationships asset={{ id: asset.id, title: asset.title }} onOpenAsset={onOpenAsset} />}
          {tab === "Usage" && <UsageTab asset={asset} />}
          {tab === "History" && <HistoryTab assetId={asset.id} />}
          {tab === "Quality" && <AssetQuality asset={{ id: asset.id, title: asset.title, public_url: asset.public_url }} onOpenAsset={onOpenAsset} />}
          {tab === "DNA" && <AssetDna asset={{ id: asset.id, title: asset.title }} onOpenAsset={onOpenAsset} />}
        </div>

        {/* Footer actions (always available) */}
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

/* ═══ Overview ═══ */
function OverviewTab({ asset, busy, fileRef, onFile, onPickFile }: {
  asset: VisualAsset; busy: string | null; fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (e: ChangeEvent<HTMLInputElement>) => void; onPickFile: () => void;
}) {
  const [dlSize, setDlSize] = useState(256);
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const state = displayState(asset);
  return (
    <>
      <div className="relative flex aspect-video w-full items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-white p-8 text-neutral-900">
        {asset.public_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.public_url} alt={asset.title} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-neutral-400"><ImageRawIcon size={32} /><span className="text-[11px] font-semibold uppercase tracking-wide">Missing — no icon yet</span></span>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp,image/*" className="hidden" onChange={onFile} />
      <button type="button" onClick={onPickFile} disabled={busy === "attach"}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-primary)] disabled:opacity-50">
        {busy === "attach" ? <SpinnerIcon size={13} className="animate-spin" /> : <UploadIcon size={13} />}
        {asset.public_url ? "Replace icon" : "Upload icon for this entity"}
      </button>

      <div className="mt-3"><span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATE_PILL[state] ?? STATE_PILL.draft}`}>{state}</span></div>

      {asset.public_url && (
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Download</span>
            <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">Size
              <select value={dlSize} onChange={(e) => setDlSize(Number(e.target.value))} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-1 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
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
        <Row label="Created" value={asset.created_at ? new Date(asset.created_at).toLocaleDateString() : "—"} />
        {asset.description && <Row label="Description" value={asset.description} />}
      </div>
      {asset.keywords?.length > 0 && <div className="py-3"><span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Keywords</span><Chips items={asset.keywords} /></div>}
      {asset.search_aliases?.length > 0 && <div className="py-1"><span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Search aliases</span><Chips items={asset.search_aliases} /></div>}
    </>
  );
}

/* ═══ Intelligence ═══ */
function IntelligenceTab({ asset, onChanged }: { asset: VisualAsset; onChanged: () => void }) {
  const [ai, setAi] = useState({
    semantic_meaning: asset.semantic_meaning ?? "", visual_style_description: asset.visual_style_description ?? "",
    ai_prompt_description: asset.ai_prompt_description ?? "", visual_family: asset.visual_family ?? "",
    shape_language: asset.shape_language ?? "", stroke_family: asset.stroke_family ?? "", corner_radius_family: asset.corner_radius_family ?? "",
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof ai, v: string) => { setAi((s) => ({ ...s, [k]: v })); setDirty(true); };
  const save = async () => { setSaving(true); const ok = await patch(asset.id, ai); setSaving(false); if (ok) { setDirty(false); onChanged(); } };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Semantic intelligence</span>
        {dirty && <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-inverted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">{saving ? <SpinnerIcon size={11} className="animate-spin" /> : null} Save</button>}
      </div>
      <AiField label="Semantic meaning" placeholder="e.g. Represents backward navigation" value={ai.semantic_meaning} onChange={(v) => set("semantic_meaning", v)} />
      <AiField label="Visual style" placeholder="e.g. Minimal monochrome rounded outline icon" value={ai.visual_style_description} onChange={(v) => set("visual_style_description", v)} />
      <AiField label="AI prompt" placeholder="e.g. Apple-style rounded outline navigation arrow" value={ai.ai_prompt_description} onChange={(v) => set("ai_prompt_description", v)} />

      <div className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Visual family</div>
      <div className="grid grid-cols-2 gap-2">
        <SmallField label="Family" value={ai.visual_family} onChange={(v) => set("visual_family", v)} placeholder="fi-rr" />
        <SmallField label="Shape language" value={ai.shape_language} onChange={(v) => set("shape_language", v)} placeholder="rounded" />
        <SmallField label="Stroke family" value={ai.stroke_family} onChange={(v) => set("stroke_family", v)} placeholder="2px" />
        <SmallField label="Corner radius" value={ai.corner_radius_family} onChange={(v) => set("corner_radius_family", v)} placeholder="soft" />
      </div>

      {asset.synonyms?.length > 0 && <div className="mt-3"><span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Synonyms</span><Chips items={asset.synonyms} /></div>}
    </div>
  );
}
function SmallField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-[var(--text-dim)]">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
    </label>
  );
}

/* ═══ Collections ═══ */
function CollectionsTab({ assetId }: { assetId: string }) {
  const [memberships, setMemberships] = useState<{ link_id: string; name: string; slug: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const load = async () => {
    setLoading(true);
    const j = await fetch(`/api/visual-library/${assetId}/collections`, { credentials: "include", cache: "no-store" }).then((r) => r.ok ? r.json() : { memberships: [] });
    setMemberships(j.memberships ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [assetId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Collections{memberships.length ? ` · ${memberships.length}` : ""}</span>
        <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--text-primary)] hover:border-[var(--border-color)]"><LayersIcon size={12} /> Add</button>
      </div>
      {loading ? <div className="flex justify-center py-6 text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /></div>
        : memberships.length === 0 ? <p className="text-[11.5px] text-[var(--text-dim)]">Not in any collection yet.</p>
        : <div className="flex flex-wrap gap-1.5">{memberships.map((m) => (
            <a key={m.link_id} href={m.slug ? `/database/collections/${m.slug}` : "#"} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11.5px] text-[var(--text-primary)] hover:border-[var(--border-color)]"><LayersIcon size={11} className="text-[var(--text-dim)]" /> {m.name}</a>
          ))}</div>}
      {showAdd && <AddToCollectionModal assetIds={[assetId]} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

/* ═══ Usage ═══ */
function UsageTab({ asset }: { asset: VisualAsset }) {
  const groups: { label: string; items: string[] }[] = [
    { label: "Modules", items: asset.used_in_modules ?? [] },
    { label: "Pages", items: asset.used_in_pages ?? [] },
    { label: "Products", items: asset.used_in_products ?? [] },
    { label: "Templates", items: asset.used_in_templates ?? [] },
    { label: "Dashboards", items: asset.used_in_dashboards ?? [] },
  ];
  const totalRefs = groups.reduce((s, g) => s + g.items.length, 0);
  const orphan = totalRefs === 0 && asset.usage_count === 0;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"><div className="text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">Downloads / uses</div><div className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">{asset.usage_count}</div></div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"><div className="text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">Last used</div><div className="mt-1 text-[13px] text-[var(--text-primary)]">{asset.last_used_at ? new Date(asset.last_used_at).toLocaleDateString() : "—"}</div></div>
      </div>
      {orphan && <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-300">⚠ Orphan — not referenced anywhere yet.</div>}
      <div className="mt-3 space-y-2.5">
        {groups.map((g) => (
          <div key={g.label}>
            <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Used in {g.label}</span>
            {g.items.length === 0 ? <p className="text-[11px] text-[var(--text-dim)]">—</p> : <Chips items={g.items} />}
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10.5px] leading-relaxed text-[var(--text-dim)]">Usage references are populated automatically as the Hub wires assets into modules, pages and products.</p>
    </div>
  );
}

/* ═══ History ═══ */
const EVENT_LABEL: Record<string, string> = {
  approved: "Approved", unapprove: "Approval removed", submit: "Submitted for review", deprecate: "Deprecated",
  archive: "Archived", restore: "Restored", file_attached: "Icon attached", file_replaced: "Icon replaced",
  governance_rule: "Governance rule", relationship: "Relationship", collection: "Collection", edited: "Edited", uploaded: "Uploaded",
};
function HistoryTab({ assetId }: { assetId: string }) {
  const [events, setEvents] = useState<VisualAssetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch(`/api/visual-library/${assetId}/events`, { credentials: "include", cache: "no-store" })
      .then((r) => r.ok ? r.json() : { events: [] }).then((j) => { if (alive) setEvents(j.events ?? []); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [assetId]);
  if (loading) return <div className="flex justify-center py-6 text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /></div>;
  if (events.length === 0) return (
    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-8 text-center">
      <ClockIcon size={22} className="mx-auto text-[var(--text-dim)]" />
      <p className="mt-2 text-[12px] text-[var(--text-muted)]">No history yet.</p>
      <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">Approvals, uploads, governance and relationship changes will appear here.</p>
    </div>
  );
  return (
    <ol className="relative ml-1 border-l border-[var(--border-subtle)] pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative py-2">
          <span className="absolute -left-[21px] top-3 h-1.5 w-1.5 rounded-full bg-[var(--text-dim)]" />
          <div className="text-[12.5px] font-medium text-[var(--text-primary)]">{e.summary || EVENT_LABEL[e.event_type] || e.event_type}</div>
          <div className="text-[10.5px] text-[var(--text-dim)]">{new Date(e.created_at).toLocaleString()}{e.actor_name ? ` · ${e.actor_name}` : ""}</div>
        </li>
      ))}
    </ol>
  );
}
