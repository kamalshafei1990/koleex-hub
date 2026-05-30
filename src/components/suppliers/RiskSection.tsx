"use client";

/* ---------------------------------------------------------------------------
   RiskSection — Supplier Risk Intelligence for the Supplier 360.

   Built on the Phase-1 Foundation supplier_risk_profile scorecard: an overall
   risk level + 0–100 internal evaluation score, level-based stability/quality
   dimensions, trust level, dependency indicators — plus an additive active-risk
   register (supplier_risk_items) with per-item visibility and a resolve
   workflow. Monochrome, restrained, intelligence-oriented. Inline edit / add /
   resolve / remove with optimistic refresh.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  RISK_LEVEL_LABELS, RISK_LEVEL_ORDER, riskLevelTone,
  QUALITY_LEVELS, QUALITY_LEVEL_LABELS, RISK_PROFILE_FIELDS,
  RISK_DIMENSIONS, RISK_DIMENSION_LABELS, riskDimensionLabel,
  SEVERITY_LABELS, SEVERITY_ORDER, RISK_STATUS_LABELS, TRUST_LABELS, DEPENDENCY_LABELS,
} from "@/lib/suppliers/intelligence";
import ShieldExclamationIcon from "@/components/icons/ui/ShieldExclamationIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import NetworkIcon from "@/components/icons/ui/NetworkIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import Edit3Icon from "@/components/icons/ui/Edit3Icon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";

type Row = Record<string, unknown>;
const str = (r: Row, k: string): string => { const v = r[k]; return typeof v === "string" ? v : typeof v === "number" ? String(v) : ""; };
const numOrEmpty = (r: Row, k: string): string => { const v = r[k]; return typeof v === "number" && Number.isFinite(v) ? String(v) : ""; };
const isTrue = (r: Row, k: string): boolean => r[k] === true;

const VISIBILITY_TIERS = ["public", "internal", "procurement", "finance", "management"] as const;
const VISIBILITY_LABELS: Record<string, string> = { public: "Public", internal: "Internal", procurement: "Procurement", finance: "Finance only", management: "Management only" };

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{children}</div>
);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>{children}</label>
);
const inputCls = "w-full rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";

const levelToneCls: Record<string, string> = {
  none: "bg-[var(--bg-surface)] text-[var(--text-faint)] ring-1 ring-[var(--border-subtle)]",
  low: "bg-[var(--bg-surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]",
  moderate: "bg-[var(--bg-surface)] text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]",
  elevated: "bg-amber-500/15 text-amber-300",
  high: "bg-rose-500/15 text-rose-300",
};
const severityCls: Record<string, string> = {
  low: "bg-[var(--bg-surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]",
  medium: "bg-[var(--bg-surface)] text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]",
  high: "bg-amber-500/15 text-amber-300",
  critical: "bg-rose-500/15 text-rose-300",
};
const qualityLabel = (v: string) => QUALITY_LEVEL_LABELS[v] ?? "—";

export default function RiskSection({
  supplierId, riskProfile, riskItems, risk, onSaved,
}: {
  supplierId: string;
  riskProfile: Row | null;
  riskItems: Row[];
  risk: { level: string | null; score: number | null; trustLevel: string | null; openItems: number; openHighRisks: number } | null;
  onSaved: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const p = riskProfile ?? {};

  const [addOpen, setAddOpen] = useState(false);
  const [iDim, setIDim] = useState("operational");
  const [iSev, setISev] = useState("medium");
  const [iTitle, setITitle] = useState("");
  const [iDesc, setIDesc] = useState("");
  const [iVis, setIVis] = useState("procurement");
  const [iBusy, setIBusy] = useState(false);
  const [iErr, setIErr] = useState<string | null>(null);

  const initial = () => {
    const o: Record<string, string | boolean> = {
      risk_level: str(p, "risk_level"), dependency_level: str(p, "dependency_level"),
      trust_level: str(p, "trust_level"), internal_evaluation_score: numOrEmpty(p, "internal_evaluation_score"),
      assessment_notes: str(p, "assessment_notes"), backup_supplier_exists: isTrue(p, "backup_supplier_exists"),
    };
    for (const f of RISK_PROFILE_FIELDS) o[f.col] = str(p, f.col);
    return o;
  };
  const [d, setD] = useState<Record<string, string | boolean>>(initial);
  const set = (k: string, v: string | boolean) => setD((x) => ({ ...x, [k]: v }));
  const openEdit = () => { setD(initial()); setErr(null); setEditing(true); };

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/risk`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      setEditing(false); await onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  };

  const addItem = async () => {
    if (!iTitle.trim()) { setIErr("Title is required"); return; }
    setIBusy(true); setIErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/risk/items`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dimension: iDim, severity: iSev, title: iTitle, description: iDesc, visibility_tier: iVis }) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      setAddOpen(false); setITitle(""); setIDesc(""); await onSaved();
    } catch (e) { setIErr(e instanceof Error ? e.message : String(e)); } finally { setIBusy(false); }
  };
  const patchItem = async (it: Row, body: Record<string, unknown>) => {
    const id = str(it, "id"); setBusyId(id); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/risk/items/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      await onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusyId(null); }
  };
  const removeItem = async (it: Row) => {
    const id = str(it, "id"); if (!confirm("Remove this risk item?")) return;
    setBusyId(id); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/risk/items/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      await onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusyId(null); }
  };

  const hasProfile = !!riskProfile;
  const openItems = riskItems.filter((r) => r.status !== "resolved");
  const resolvedItems = riskItems.filter((r) => r.status === "resolved");
  const levelTone = riskLevelTone(risk?.level);

  /* ── EDIT MODE ── */
  if (editing) {
    return (
      <section className="space-y-5">
        <div className="flex items-center gap-2"><ShieldExclamationIcon className="h-4 w-4 text-[var(--text-secondary)]" /><h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">Edit Risk Profile</h3></div>
        <div className="space-y-5 rounded-2xl bg-[var(--bg-surface-subtle)] p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Field label="Overall risk level"><select className={inputCls} value={d.risk_level as string} onChange={(e) => set("risk_level", e.target.value)}><option value="">—</option>{RISK_LEVEL_ORDER.map((k) => <option key={k} value={k}>{RISK_LEVEL_LABELS[k]}</option>)}</select></Field>
            <Field label="Evaluation score (0–100)"><input type="number" min={0} max={100} className={inputCls} value={d.internal_evaluation_score as string} onChange={(e) => set("internal_evaluation_score", e.target.value)} /></Field>
            <Field label="Trust level"><select className={inputCls} value={d.trust_level as string} onChange={(e) => set("trust_level", e.target.value)}><option value="">—</option>{Object.keys(TRUST_LABELS).map((k) => <option key={k} value={k}>{TRUST_LABELS[k]}</option>)}</select></Field>
            <Field label="Dependency level"><select className={inputCls} value={d.dependency_level as string} onChange={(e) => set("dependency_level", e.target.value)}><option value="">—</option>{RISK_LEVEL_ORDER.map((k) => <option key={k} value={k}>{DEPENDENCY_LABELS[k]}</option>)}</select></Field>
          </div>
          <div className="space-y-2">
            <SectionLabel>Stability &amp; quality (higher = healthier)</SectionLabel>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {RISK_PROFILE_FIELDS.map((f) => (
                <Field key={f.col} label={f.label}><select className={inputCls} value={d[f.col] as string} onChange={(e) => set(f.col, e.target.value)}><option value="">—</option>{QUALITY_LEVELS.map((k) => <option key={k} value={k}>{QUALITY_LEVEL_LABELS[k]}</option>)}</select></Field>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => set("backup_supplier_exists", !(d.backup_supplier_exists as boolean))} className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${d.backup_supplier_exists ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>Backup supplier available</button>
          </div>
          <Field label="Assessment notes"><textarea className={`${inputCls} min-h-[60px]`} value={d.assessment_notes as string} onChange={(e) => set("assessment_notes", e.target.value)} /></Field>
          {err ? <div className="text-[12px] text-rose-400">{err}</div> : null}
          <div className="flex items-center gap-3">
            <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">{saving ? "Saving…" : "Save risk profile"}</button>
            <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">Cancel</button>
          </div>
        </div>
      </section>
    );
  }

  /* ── VIEW MODE ── */
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><ShieldExclamationIcon className="h-4 w-4 text-[var(--text-secondary)]" /><h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">Risk Intelligence</h3></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setIDim("operational"); setISev("medium"); setITitle(""); setIDesc(""); setIVis("procurement"); setIErr(null); setAddOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><PlusIcon className="h-3.5 w-3.5" /> Raise risk</button>
          <button type="button" onClick={openEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Edit3Icon className="h-3.5 w-3.5" /> {hasProfile ? "Edit" : "Score risk"}</button>
        </div>
      </div>

      {err ? <div className="text-[12px] text-rose-400">{err}</div> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${levelToneCls[levelTone]}`}>{risk?.level ? RISK_LEVEL_LABELS[risk.level] : "Unscored"}</span>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">Overall risk</div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4">
          <div className="flex items-baseline gap-1"><span className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{risk?.score ?? "—"}</span>{risk?.score != null ? <span className="text-xs text-[var(--text-faint)]">/100</span> : null}</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">Evaluation score</div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]"><ShieldCheckIcon className="h-3.5 w-3.5" />{risk?.trustLevel ? TRUST_LABELS[risk.trustLevel] : "—"}</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">Trust level</div>
        </div>
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4">
          <div className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{openItems.length}</div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-faint)]">Active risks</div>
        </div>
      </div>

      {(risk?.openHighRisks ?? 0) > 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-rose-500/[0.08] px-3 py-2 text-[12px] text-rose-300"><TriangleWarningIcon className="h-4 w-4 shrink-0" />{risk?.openHighRisks} high/critical risk{(risk?.openHighRisks ?? 0) > 1 ? "s are" : " is"} open and unresolved.</div>
      ) : null}

      {hasProfile ? (
        <div className="space-y-2.5">
          <SectionLabel>Stability &amp; quality</SectionLabel>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl bg-[var(--bg-surface-subtle)] p-5 sm:grid-cols-3">
            {RISK_PROFILE_FIELDS.map((f) => (
              <div key={f.col} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--text-secondary)]">{f.label}</span>
                <span className="text-[11px] font-medium text-[var(--text-primary)]">{str(p, f.col) ? qualityLabel(str(p, f.col)) : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {hasProfile && (str(p, "dependency_level") || isTrue(p, "backup_supplier_exists") || str(p, "assessment_notes")) ? (
        <div className="space-y-2.5">
          <SectionLabel>Dependency &amp; assessment</SectionLabel>
          <div className="space-y-3 rounded-2xl bg-[var(--bg-surface-subtle)] p-5">
            <div className="flex flex-wrap gap-1.5">
              {str(p, "dependency_level") ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]"><NetworkIcon className="h-3 w-3" />Dependency: {DEPENDENCY_LABELS[str(p, "dependency_level")]}</span> : null}
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">{isTrue(p, "backup_supplier_exists") ? "Backup available" : "No backup supplier"}</span>
            </div>
            {str(p, "assessment_notes") ? <div className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{str(p, "assessment_notes")}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-2.5">
        <SectionLabel>Active risks</SectionLabel>
        {openItems.length === 0 ? (
          <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-8 text-center text-sm text-[var(--text-faint)]">No active risks recorded.</div>
        ) : (
          <div className="space-y-2">
            {openItems.map((it) => {
              const id = str(it, "id");
              return (
                <div key={id} className="rounded-xl bg-[var(--bg-surface-subtle)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${severityCls[str(it, "severity")] ?? severityCls.medium}`}>{SEVERITY_LABELS[str(it, "severity")] ?? str(it, "severity")}</span>
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{str(it, "title")}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">{riskDimensionLabel(str(it, "dimension"))} · {RISK_STATUS_LABELS[str(it, "status")] ?? str(it, "status")} · <ShieldCheckIcon className="inline h-2.5 w-2.5" /> {VISIBILITY_LABELS[str(it, "visibility_tier")] ?? "Procurement"}</div>
                      {str(it, "description") ? <div className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{str(it, "description")}</div> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {str(it, "status") !== "mitigating" ? <button type="button" disabled={busyId === id} onClick={() => patchItem(it, { status: "mitigating" })} className="rounded-md px-1.5 py-1 text-[10px] font-medium text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-40">Mitigate</button> : null}
                      <button type="button" disabled={busyId === id} onClick={() => patchItem(it, { status: "resolved" })} className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-40" title="Resolve"><CheckCircleIcon className="h-3.5 w-3.5" /></button>
                      <button type="button" disabled={busyId === id} onClick={() => removeItem(it)} className="rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-rose-400 disabled:opacity-40" title="Remove"><TrashIcon className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {resolvedItems.length ? <div className="text-[11px] text-[var(--text-faint)]">{resolvedItems.length} resolved risk{resolvedItems.length > 1 ? "s" : ""} in history.</div> : null}
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !iBusy && setAddOpen(false)}>
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><ShieldExclamationIcon className="h-4 w-4 text-[var(--text-secondary)]" /><span className="text-[14px] font-semibold text-[var(--text-primary)]">Raise a risk</span></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dimension"><select className={inputCls} value={iDim} onChange={(e) => setIDim(e.target.value)}>{RISK_DIMENSIONS.map((dm) => <option key={dm} value={dm}>{RISK_DIMENSION_LABELS[dm]}</option>)}</select></Field>
              <Field label="Severity"><select className={inputCls} value={iSev} onChange={(e) => setISev(e.target.value)}>{SEVERITY_ORDER.map((s) => <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>)}</select></Field>
            </div>
            <Field label="Title"><input className={inputCls} value={iTitle} onChange={(e) => setITitle(e.target.value)} placeholder="e.g. Repeated 2-week shipment delays" /></Field>
            <Field label="Details"><textarea className={`${inputCls} min-h-[60px]`} value={iDesc} onChange={(e) => setIDesc(e.target.value)} /></Field>
            <Field label="Visibility"><select className={inputCls} value={iVis} onChange={(e) => setIVis(e.target.value)}>{VISIBILITY_TIERS.map((t) => <option key={t} value={t}>{VISIBILITY_LABELS[t]}</option>)}</select></Field>
            {iErr ? <div className="text-[12px] text-rose-400">{iErr}</div> : null}
            <div className="flex items-center gap-3">
              <button type="button" disabled={iBusy} onClick={addItem} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">{iBusy ? "Saving…" : "Raise risk"}</button>
              <button type="button" onClick={() => setAddOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
