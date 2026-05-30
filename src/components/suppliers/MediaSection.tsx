"use client";

/* ---------------------------------------------------------------------------
   MediaSection — Supplier Evidence & Intelligence Assets for the Supplier 360.

   Governed media/documents rendered as procurement evidence: category-grouped
   cards, first-class certification cards (type / issuer / issue+expiry /
   verification + expiry state / markets), lifecycle + visibility indicators,
   verification workflow, and a governed upload pipeline that routes sensitive
   assets (finance/management visibility, contracts, NDAs, audits, licenses) to
   a private bucket served via short-lived signed URLs.

   Monochrome, evidence-oriented — not a cloud-storage clone. Inline upload /
   verify / edit / archive / remove / change-visibility with optimistic refresh.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";
import { uploadToStorage } from "@/lib/storage-client";
import {
  DOC_CATEGORY_GROUPS, docCategoryLabel,
  CERT_TYPE_LABELS, CERT_TYPE_ORDER, certTypeLabel,
  LIFECYCLE_LABELS, isSensitiveAsset,
} from "@/lib/suppliers/intelligence";
import FileBadge2Icon from "@/components/icons/ui/FileBadge2Icon";
import FileIcon from "@/components/icons/ui/FileIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import FilmIcon from "@/components/icons/ui/FilmIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import ArchiveIcon from "@/components/icons/ui/ArchiveIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";

type Row = Record<string, unknown>;
const str = (r: Row, k: string): string => {
  const v = r[k];
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
};
const arr = (r: Row, k: string): string[] => (Array.isArray(r[k]) ? (r[k] as unknown[]).map(String) : []);

const VISIBILITY_TIERS = ["public", "internal", "procurement", "finance", "management"] as const;
const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public", internal: "Internal", procurement: "Procurement",
  finance: "Finance only", management: "Management only",
};
const todayStr = () => new Date().toISOString().slice(0, 10);

const mediaClassFromMime = (mime: string): string => {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{children}</div>
);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
    {children}
  </label>
);
const inputCls =
  "w-full rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";

/* certification expiry state */
function certState(m: Row): { label: string; tone: "ok" | "warn" | "danger" | "neutral" } {
  const exp = str(m, "expiry_date");
  const verified = !!m.verified_at;
  if (exp && exp < todayStr()) return { label: "Expired", tone: "danger" };
  if (exp) {
    const days = Math.ceil((new Date(exp).getTime() - Date.now()) / 86400000);
    if (days <= 60) return { label: `Expires in ${days}d`, tone: "warn" };
  }
  if (!verified) return { label: "Pending", tone: "neutral" };
  return { label: "Verified", tone: "ok" };
}
const toneCls: Record<string, string> = {
  ok: "bg-[var(--text-primary)] text-[var(--bg-primary)]",
  warn: "bg-amber-500/15 text-amber-300",
  danger: "bg-rose-500/15 text-rose-300",
  neutral: "bg-[var(--bg-surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]",
};

function MediaGlyph({ m }: { m: Row }) {
  const cls = "h-4 w-4 text-[var(--text-faint)]";
  if (m.category === "certification") return <FileBadge2Icon className={cls} />;
  if (m.media_class === "image") return <PictureIcon className={cls} />;
  if (m.media_class === "video") return <FilmIcon className={cls} />;
  return <FileIcon className={cls} />;
}

export default function MediaSection({
  supplierId,
  media,
  onSaved,
}: {
  supplierId: string;
  media: Row[];
  onSaved: () => void | Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // upload modal
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("certification");
  const [visibility, setVisibility] = useState("internal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [certType, setCertType] = useState("iso");
  const [issuer, setIssuer] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [markets, setMarkets] = useState("");
  const [busy, setBusy] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);

  const isCert = category === "certification";

  const grouped = useMemo(() => {
    return DOC_CATEGORY_GROUPS
      .map((g) => ({ ...g, items: media.filter((m) => g.categories.includes(String(m.category))) }))
      .filter((g) => g.items.length > 0);
  }, [media]);

  const expiredCount = useMemo(
    () => media.filter((m) => m.category === "certification" && str(m, "expiry_date") && str(m, "expiry_date") < todayStr()).length,
    [media],
  );

  const openUpload = () => {
    setFile(null); setCategory("certification"); setVisibility("internal");
    setTitle(""); setDescription(""); setCertType("iso"); setIssuer("");
    setIssuedDate(""); setExpiryDate(""); setMarkets(""); setUpErr(null); setOpen(true);
  };

  const save = async () => {
    if (!file) { setUpErr("Choose a file first"); return; }
    setBusy(true); setUpErr(null);
    try {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const bucket = isSensitiveAsset(category, visibility) ? "finance-documents" : "media";
      const path = `suppliers/${supplierId}/docs/${crypto.randomUUID()}.${ext}`;
      const up = await uploadToStorage(bucket, path, file, { contentType: file.type || undefined });
      if (!up.ok) throw new Error(humanizeError(up.error));
      const body: Record<string, unknown> = {
        file_url: up.data.publicUrl,
        preview_url: file.type.startsWith("image/") ? up.data.publicUrl : null,
        storage_bucket: bucket,
        storage_path: up.data.path,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        file_ext: ext,
        media_class: mediaClassFromMime(file.type || ""),
        category,
        visibility,
        title: title.trim() || null,
        description: description.trim() || null,
        lifecycle_status: "active",
      };
      if (isCert) {
        body.cert_type = certType;
        body.issuer = issuer.trim() || null;
        body.issued_date = issuedDate || null;
        body.expiry_date = expiryDate || null;
        body.markets_covered = markets.split(",").map((x) => x.trim()).filter(Boolean);
      }
      const r = await fetch(`/api/suppliers/${supplierId}/media`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      setOpen(false);
      await onSaved();
    } catch (e) {
      setUpErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const patch = async (m: Row, body: Record<string, unknown>) => {
    const id = str(m, "id");
    setBusyId(id); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/media/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusyId(null); }
  };

  const remove = async (m: Row) => {
    const id = str(m, "id");
    if (!confirm("Remove this asset? It will be archived (recoverable).")) return;
    setBusyId(id); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/media/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusyId(null); }
  };

  const cycleVisibility = (m: Row) => {
    const cur = str(m, "visibility");
    const i = VISIBILITY_TIERS.indexOf(cur as typeof VISIBILITY_TIERS[number]);
    const next = VISIBILITY_TIERS[(i + 1) % VISIBILITY_TIERS.length];
    patch(m, { visibility: next });
  };

  const hasData = media.length > 0;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayersIcon className="h-4 w-4 text-[var(--text-secondary)]" />
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">Evidence &amp; Documents</h3>
        </div>
        <button type="button" onClick={openUpload}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90">
          <PlusIcon className="h-3.5 w-3.5" /> Add asset
        </button>
      </div>

      {expiredCount > 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-rose-500/[0.08] px-3 py-2 text-[12px] text-rose-300">
          <TriangleWarningIcon className="h-4 w-4 shrink-0" />
          {expiredCount} certification{expiredCount > 1 ? "s have" : " has"} expired — re-verify to restore sourcing trust.
        </div>
      ) : null}
      {err ? <div className="text-[12px] text-rose-400">{err}</div> : null}

      {!hasData ? (
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-12 text-center text-sm text-[var(--text-faint)]">
          No evidence assets yet — upload certifications, factory photos, catalogs, and audit reports to build verifiable sourcing trust.
        </div>
      ) : null}

      {grouped.map((g) => (
        <div key={g.key} className="space-y-2.5">
          <SectionLabel>{g.label}</SectionLabel>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {g.items.map((m) => {
              const id = str(m, "id");
              const url = str(m, "file_url");
              const isCertCard = m.category === "certification";
              const st = certState(m);
              const verified = !!m.verified_at;
              return (
                <div key={id} className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      {/* thumbnail or glyph */}
                      {m.media_class === "image" && url ? (
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-surface)] ring-1 ring-[var(--border-subtle)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={str(m, "title") || "asset"} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] ring-1 ring-[var(--border-subtle)]">
                          <MediaGlyph m={m} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isCertCard && str(m, "cert_type") ? (
                            <span className="rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]">
                              {certTypeLabel(str(m, "cert_type"))}
                            </span>
                          ) : null}
                          <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                            {str(m, "title") || docCategoryLabel(str(m, "category"))}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-[var(--text-faint)]">
                          {[docCategoryLabel(str(m, "category")), str(m, "issuer")].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                    {/* verification / state badge */}
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneCls[st.tone]}`}>
                      {st.tone === "danger" ? <TriangleWarningIcon className="h-2.5 w-2.5" /> : st.tone === "ok" ? <BadgeCheckIcon className="h-2.5 w-2.5" /> : st.tone === "warn" ? <ClockIcon className="h-2.5 w-2.5" /> : null}
                      {st.label}
                    </span>
                  </div>

                  {/* certification metadata */}
                  {isCertCard && (str(m, "issued_date") || str(m, "expiry_date") || arr(m, "markets_covered").length) ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-faint)]">
                        {str(m, "issued_date") ? <span>Issued {str(m, "issued_date")}</span> : null}
                        {str(m, "expiry_date") ? <span>Expires {str(m, "expiry_date")}</span> : null}
                        {str(m, "doc_number") ? <span>No. {str(m, "doc_number")}</span> : null}
                      </div>
                      {arr(m, "markets_covered").length ? (
                        <div className="flex flex-wrap gap-1">
                          {arr(m, "markets_covered").map((mk, i) => (
                            <span key={`${mk}-${i}`} className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{mk}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {str(m, "description") ? <div className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{str(m, "description")}</div> : null}

                  {/* footer: lifecycle + visibility + actions */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-faint)]">
                      <button type="button" onClick={() => cycleVisibility(m)} disabled={busyId === id}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] disabled:opacity-40" title="Click to change visibility">
                        <ShieldCheckIcon className="h-3 w-3" />{VISIBILITY_LABELS[str(m, "visibility")] ?? "Internal"}
                      </button>
                      {str(m, "lifecycle_status") && str(m, "lifecycle_status") !== "active" ? (
                        <span className="text-[var(--text-faint)]">· {LIFECYCLE_LABELS[str(m, "lifecycle_status")] ?? str(m, "lifecycle_status")}</span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {url ? (
                        <a href={url} download target="_blank" rel="noopener noreferrer"
                          className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]" title="Download"><DownloadIcon className="h-3.5 w-3.5" /></a>
                      ) : null}
                      <button type="button" disabled={busyId === id} onClick={() => patch(m, { verify: !verified })}
                        className={`rounded-md p-1.5 hover:bg-[var(--bg-surface)] disabled:opacity-40 ${verified ? "text-[var(--text-primary)]" : "text-[var(--text-faint)] hover:text-[var(--text-primary)]"}`}
                        title={verified ? "Un-verify" : "Mark verified"}><BadgeCheckIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={busyId === id} onClick={() => patch(m, { lifecycle_status: str(m, "lifecycle_status") === "archived" ? "active" : "archived" })}
                        className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-40" title="Archive / restore"><ArchiveIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={busyId === id} onClick={() => remove(m)}
                        className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-rose-400 disabled:opacity-40" title="Remove"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── upload modal ── */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-lg space-y-4 overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <UploadIcon className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">Add evidence asset</span>
            </div>
            <Field label="File (image, PDF, video, document)">
              <input type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-[12px] text-[var(--text-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--bg-surface-subtle)] file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-[var(--text-primary)]" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {DOC_CATEGORY_GROUPS.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {g.categories.map((c) => <option key={c} value={c}>{docCategoryLabel(c)}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Visibility">
                <select className={inputCls} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                  {VISIBILITY_TIERS.map((t) => <option key={t} value={t}>{VISIBILITY_LABELS[t]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Title (optional)"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isCert ? "e.g. ISO 9001:2015" : "e.g. 2025 Product Catalog"} /></Field>

            {isCert ? (
              <div className="space-y-3 rounded-xl bg-[var(--bg-surface-subtle)] p-3">
                <SectionLabel>Certification intelligence</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <select className={inputCls} value={certType} onChange={(e) => setCertType(e.target.value)}>
                      {CERT_TYPE_ORDER.map((k) => <option key={k} value={k}>{CERT_TYPE_LABELS[k]}</option>)}
                    </select>
                  </Field>
                  <Field label="Issuing authority"><input className={inputCls} value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="SGS / TÜV / BV" /></Field>
                  <Field label="Issue date"><input type="date" className={inputCls} value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} /></Field>
                  <Field label="Expiry date"><input type="date" className={inputCls} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></Field>
                </div>
                <Field label="Markets covered (comma-separated)"><input className={inputCls} value={markets} onChange={(e) => setMarkets(e.target.value)} placeholder="EU, USA, Japan" /></Field>
              </div>
            ) : null}

            <Field label="Description (optional)"><textarea className={`${inputCls} min-h-[56px]`} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

            {isSensitiveAsset(category, visibility) ? (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-faint)]"><ShieldCheckIcon className="h-3.5 w-3.5" />Stored privately — served via short-lived signed links only.</div>
            ) : null}
            {upErr ? <div className="text-[12px] text-rose-400">{upErr}</div> : null}
            <div className="flex items-center gap-3">
              <button type="button" disabled={busy} onClick={save}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
                <UploadIcon className="h-3.5 w-3.5" />{busy ? "Uploading…" : "Upload asset"}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
