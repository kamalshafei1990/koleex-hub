"use client";

/* ---------------------------------------------------------------------------
   NegotiationSection — Supplier Negotiation Intelligence for the Supplier 360.

   Negotiation memory: rounds, concessions (price / MOQ / payment terms /
   discount), exclusivity & territory discussions, leverage points, red flags,
   and supplier behavior patterns. Default management-visibility (most sensitive
   procurement intelligence). Monochrome, restrained. Inline add / remove with
   optimistic refresh.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { contactsT } from "@/lib/translations/contacts";
import { humanizeError } from "@/lib/ui/humanize-error";
import { NEGOTIATION_INTEL_FIELDS, QUALITY_LEVELS, QUALITY_LEVEL_LABELS } from "@/lib/suppliers/intelligence";
import HandshakeIcon from "@/components/icons/ui/HandshakeIcon";
import Edit3Icon from "@/components/icons/ui/Edit3Icon";
import GaugeIcon from "@/components/icons/ui/GaugeIcon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";
import FlagIcon from "@/components/icons/ui/FlagIcon";
import PercentIcon from "@/components/icons/ui/PercentIcon";
import ShieldCheckIcon from "@/components/icons/ui/ShieldCheckIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";

type Row = Record<string, unknown>;
const str = (r: Row, k: string): string => { const v = r[k]; return typeof v === "string" ? v : typeof v === "number" ? String(v) : ""; };
const isTrue = (r: Row, k: string): boolean => r[k] === true;

const VISIBILITY_TIERS = ["procurement", "finance", "management"] as const;
const VISIBILITY_LABELS: Record<string, string> = { public: "Public", internal: "Internal", procurement: "Procurement", finance: "Finance only", management: "Management only" };

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{children}</div>
);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block"><span className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>{children}</label>
);
const inputCls = "w-full rounded-lg bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:ring-1 focus:ring-[var(--border-subtle)]";

const Chip = ({ label, value }: { label: string; value: string }) =>
  value ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"><span className="text-[var(--text-faint)]">{label}</span> {value}</span> : null;

const emptyDraft = () => ({
  round_no: "", topic: "", outcome: "", price_concession: "", moq_concession: "", payment_terms_concession: "",
  discount_pct: "", leverage_notes: "", red_flags: "", behavior_notes: "",
  visibility_tier: "management", occurred_on: "", exclusivity_discussed: false, territory_discussed: false,
});

export default function NegotiationSection({
  supplierId, negotiations, negotiationIntel, onSaved,
}: {
  supplierId: string;
  negotiations: Row[];
  negotiationIntel: Row | null;
  onSaved: () => void | Promise<void>;
}) {
  const { t } = useTranslation(contactsT);
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const set = (k: keyof ReturnType<typeof emptyDraft>, v: unknown) => setD((x) => ({ ...x, [k]: v }));

  // negotiation_intel scorecard editor
  const ni = negotiationIntel ?? {};
  const niInitial = () => {
    const o: Record<string, string> = {
      negotiation_score: typeof ni.negotiation_score === "number" ? String(ni.negotiation_score) : "",
      internal_notes: str(ni, "internal_notes"),
      preferred_tactics: (Array.isArray(ni.preferred_tactics) ? (ni.preferred_tactics as unknown[]).map(String) : []).join(", "),
      leverage_points: (Array.isArray(ni.leverage_points) ? (ni.leverage_points as unknown[]).map(String) : []).join(", "),
    };
    for (const f of NEGOTIATION_INTEL_FIELDS) o[f.col] = str(ni, f.col);
    return o;
  };
  const [niEdit, setNiEdit] = useState(false);
  const [niD, setNiD] = useState<Record<string, string>>(niInitial);
  const [niBusy, setNiBusy] = useState(false);
  const [niErr, setNiErr] = useState<string | null>(null);
  const setNi = (k: string, v: string) => setNiD((x) => ({ ...x, [k]: v }));
  const hasIntel = !!negotiationIntel;

  const saveIntel = async () => {
    setNiBusy(true); setNiErr(null);
    try {
      const body: Record<string, unknown> = { ...niD };
      body.preferred_tactics = niD.preferred_tactics.split(",").map((s) => s.trim()).filter(Boolean);
      body.leverage_points = niD.leverage_points.split(",").map((s) => s.trim()).filter(Boolean);
      const r = await fetch(`/api/suppliers/${supplierId}/negotiations/intel`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      setNiEdit(false); await onSaved();
    } catch (e) { setNiErr(e instanceof Error ? e.message : String(e)); } finally { setNiBusy(false); }
  };

  const save = async () => {
    if (!d.topic.trim()) { setErr(t("neg.topicRequired", "Topic is required")); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/negotiations`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      setOpen(false); setD(emptyDraft()); await onSaved();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  const remove = async (n: Row) => {
    const id = str(n, "id"); if (!confirm(t("neg.confirmRemove", "Remove this negotiation round?"))) return;
    setBusyId(id); setListErr(null);
    try {
      const r = await fetch(`/api/suppliers/${supplierId}/negotiations/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`)); }
      await onSaved();
    } catch (e) { setListErr(e instanceof Error ? e.message : String(e)); } finally { setBusyId(null); }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><HandshakeIcon className="h-4 w-4 text-[var(--text-secondary)]" /><h3 className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">{t("neg.title", "Negotiation Intelligence")}</h3></div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setNiD(niInitial()); setNiErr(null); setNiEdit(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Edit3Icon className="h-3.5 w-3.5" /> {hasIntel ? t("neg.editScorecard", "Edit scorecard") : t("neg.score", "Score")}</button>
          <button type="button" onClick={() => { setD(emptyDraft()); setErr(null); setOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90"><PlusIcon className="h-3.5 w-3.5" /> {t("neg.logRound", "Log round")}</button>
        </div>
      </div>

      {/* scorecard */}
      {hasIntel ? (
        <div className="space-y-3 rounded-2xl bg-[var(--bg-surface-subtle)] p-5">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>{t("neg.scorecard", "Negotiation scorecard")}</SectionLabel>
            {typeof ni.negotiation_score === "number" ? <span className="inline-flex items-baseline gap-1 text-[var(--text-primary)]"><GaugeIcon className="h-3.5 w-3.5 text-[var(--text-faint)]" /><span className="text-lg font-semibold tracking-tight">{ni.negotiation_score as number}</span><span className="text-[10px] text-[var(--text-faint)]">/100</span></span> : null}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {NEGOTIATION_INTEL_FIELDS.filter((f) => str(ni, f.col)).map((f) => (
              <div key={f.col} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--text-secondary)]">{f.label}</span>
                <span className="text-[11px] font-medium text-[var(--text-primary)]">{QUALITY_LEVEL_LABELS[str(ni, f.col)] ?? str(ni, f.col)}</span>
              </div>
            ))}
          </div>
          {Array.isArray(ni.leverage_points) && (ni.leverage_points as unknown[]).length ? (
            <div className="flex flex-wrap gap-1.5"><span className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{t("neg.leverageLabel", "Leverage:")}</span>{(ni.leverage_points as unknown[]).map((x, i) => <span key={i} className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{String(x)}</span>)}</div>
          ) : null}
          {Array.isArray(ni.preferred_tactics) && (ni.preferred_tactics as unknown[]).length ? (
            <div className="flex flex-wrap gap-1.5"><span className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{t("neg.tacticsLabel", "Tactics:")}</span>{(ni.preferred_tactics as unknown[]).map((x, i) => <span key={i} className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">{String(x)}</span>)}</div>
          ) : null}
          {str(ni, "internal_notes") ? <div className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{str(ni, "internal_notes")}</div> : null}
        </div>
      ) : null}

      {listErr ? <div className="text-[12px] text-rose-400">{listErr}</div> : null}

      {/* scorecard edit modal */}
      {niEdit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !niBusy && setNiEdit(false)}>
          <div className="max-h-[88vh] w-full max-w-lg space-y-4 overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><GaugeIcon className="h-4 w-4 text-[var(--text-secondary)]" /><span className="text-[14px] font-semibold text-[var(--text-primary)]">{t("neg.scorecard", "Negotiation scorecard")}</span></div>
            <div className="grid grid-cols-2 gap-3">
              {NEGOTIATION_INTEL_FIELDS.map((f) => (
                <Field key={f.col} label={f.label}><select className={inputCls} value={niD[f.col] ?? ""} onChange={(e) => setNi(f.col, e.target.value)}><option value="">—</option>{QUALITY_LEVELS.map((k) => <option key={k} value={k}>{QUALITY_LEVEL_LABELS[k]}</option>)}</select></Field>
              ))}
            </div>
            <Field label={t("neg.fieldNegotiationScore", "Negotiation score (0–100)")}><input type="number" min={0} max={100} className={inputCls} value={niD.negotiation_score} onChange={(e) => setNi("negotiation_score", e.target.value)} /></Field>
            <Field label={t("neg.fieldLeveragePoints", "Leverage points (comma-separated)")}><input className={inputCls} value={niD.leverage_points} onChange={(e) => setNi("leverage_points", e.target.value)} placeholder={t("neg.phLeveragePoints", "60% of export volume, few alternatives")} /></Field>
            <Field label={t("neg.fieldPreferredTactics", "Preferred tactics (comma-separated)")}><input className={inputCls} value={niD.preferred_tactics} onChange={(e) => setNi("preferred_tactics", e.target.value)} placeholder={t("neg.phPreferredTactics", "anchor high, bundle MOQ + price")} /></Field>
            <Field label={t("neg.fieldInternalNotes", "Internal notes")}><textarea className={`${inputCls} min-h-[56px]`} value={niD.internal_notes} onChange={(e) => setNi("internal_notes", e.target.value)} /></Field>
            {niErr ? <div className="text-[12px] text-rose-400">{niErr}</div> : null}
            <div className="flex items-center gap-3">
              <button type="button" disabled={niBusy} onClick={saveIntel} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">{niBusy ? t("neg.saving", "Saving…") : t("neg.saveScorecard", "Save scorecard")}</button>
              <button type="button" onClick={() => setNiEdit(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("neg.cancel", "Cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {negotiations.length === 0 ? (
        <div className="rounded-2xl bg-[var(--bg-surface-subtle)]/50 px-6 py-12 text-center text-sm text-[var(--text-faint)]">{t("neg.empty", "No negotiation history yet — log rounds, concessions, leverage points, and red flags to build negotiation memory.")}</div>
      ) : (
        <div className="space-y-3">
          {negotiations.map((n) => {
            const id = str(n, "id");
            return (
              <div key={id} className="rounded-2xl bg-[var(--bg-surface-subtle)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {str(n, "round_no") ? <span className="rounded-md bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]">R{str(n, "round_no")}</span> : null}
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">{str(n, "topic")}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-faint)]">{str(n, "occurred_on") || ""}{str(n, "occurred_on") ? " · " : ""}<ShieldCheckIcon className="inline h-2.5 w-2.5" /> {VISIBILITY_LABELS[str(n, "visibility_tier")] ?? t("neg.managementOnly", "Management only")}</div>
                  </div>
                  <button type="button" disabled={busyId === id} onClick={() => remove(n)} className="shrink-0 rounded-md p-1.5 text-[var(--text-faint)] hover:bg-[var(--bg-surface)] hover:text-rose-400 disabled:opacity-40" title={t("neg.remove", "Remove")}><TrashIcon className="h-3.5 w-3.5" /></button>
                </div>

                {str(n, "outcome") ? <div className="text-[12px] leading-relaxed text-[var(--text-primary)]">{str(n, "outcome")}</div> : null}

                {(str(n, "price_concession") || str(n, "moq_concession") || str(n, "payment_terms_concession") || str(n, "discount_pct") || isTrue(n, "exclusivity_discussed") || isTrue(n, "territory_discussed")) ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Chip label={t("neg.chipPrice", "Price")} value={str(n, "price_concession")} />
                    <Chip label={t("neg.chipMoq", "MOQ")} value={str(n, "moq_concession")} />
                    <Chip label={t("neg.chipTerms", "Terms")} value={str(n, "payment_terms_concession")} />
                    {str(n, "discount_pct") ? <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"><PercentIcon className="h-3 w-3" />{str(n, "discount_pct")}%</span> : null}
                    {isTrue(n, "exclusivity_discussed") ? <span className="rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">{t("neg.exclusivityDiscussed", "Exclusivity discussed")}</span> : null}
                    {isTrue(n, "territory_discussed") ? <span className="rounded-full bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">{t("neg.territoryDiscussed", "Territory discussed")}</span> : null}
                  </div>
                ) : null}

                {str(n, "leverage_notes") ? <div className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]"><ScaleIcon className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-faint)]" /><span><span className="text-[var(--text-faint)]">{t("neg.leverageLabel", "Leverage:")}</span> {str(n, "leverage_notes")}</span></div> : null}
                {str(n, "red_flags") ? <div className="flex items-start gap-1.5 text-[11px] text-rose-300"><FlagIcon className="mt-0.5 h-3 w-3 shrink-0" /><span>{str(n, "red_flags")}</span></div> : null}
                {str(n, "behavior_notes") ? <div className="text-[11px] leading-relaxed text-[var(--text-secondary)]"><span className="text-[var(--text-faint)]">{t("neg.behaviorLabel", "Behavior:")}</span> {str(n, "behavior_notes")}</div> : null}
              </div>
            );
          })}
        </div>
      )}

      {/* composer */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-lg space-y-4 overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><HandshakeIcon className="h-4 w-4 text-[var(--text-secondary)]" /><span className="text-[14px] font-semibold text-[var(--text-primary)]">{t("neg.logModalTitle", "Log negotiation round")}</span></div>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("neg.fieldRoundNo", "Round #")}><input type="number" min={1} className={inputCls} value={d.round_no ?? ""} onChange={(e) => set("round_no" as keyof ReturnType<typeof emptyDraft>, e.target.value)} /></Field>
              <Field label={t("neg.fieldDate", "Date")}><input type="date" className={inputCls} value={d.occurred_on} onChange={(e) => set("occurred_on", e.target.value)} /></Field>
              <Field label={t("neg.fieldVisibility", "Visibility")}><select className={inputCls} value={d.visibility_tier} onChange={(e) => set("visibility_tier", e.target.value)}>{VISIBILITY_TIERS.map((tier) => <option key={tier} value={tier}>{VISIBILITY_LABELS[tier]}</option>)}</select></Field>
            </div>
            <Field label={t("neg.fieldTopic", "Topic")}><input className={inputCls} value={d.topic} onChange={(e) => set("topic", e.target.value)} placeholder={t("neg.phTopic", "e.g. 2025 annual pricing + MOQ")} /></Field>
            <Field label={t("neg.fieldOutcome", "Outcome / agreement")}><textarea className={`${inputCls} min-h-[56px]`} value={d.outcome} onChange={(e) => set("outcome", e.target.value)} placeholder={t("neg.phOutcome", "Recording an outcome logs an 'Agreement reached' timeline event.")} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("neg.fieldPriceConcession", "Price concession")}><input className={inputCls} value={d.price_concession} onChange={(e) => set("price_concession", e.target.value)} placeholder={t("neg.phPriceConcession", "-4% on servo motors")} /></Field>
              <Field label={t("neg.fieldMoqConcession", "MOQ concession")}><input className={inputCls} value={d.moq_concession} onChange={(e) => set("moq_concession", e.target.value)} placeholder={t("neg.phMoqConcession", "500 → 300 units")} /></Field>
              <Field label={t("neg.fieldPaymentTermConcession", "Payment-term concession")}><input className={inputCls} value={d.payment_terms_concession} onChange={(e) => set("payment_terms_concession", e.target.value)} placeholder={t("neg.phPaymentTermConcession", "30% TT → 20% TT")} /></Field>
              <Field label={t("neg.fieldDiscountPct", "Discount %")}><input type="number" min={0} max={100} className={inputCls} value={d.discount_pct} onChange={(e) => set("discount_pct", e.target.value)} /></Field>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([["exclusivity_discussed", t("neg.exclusivityDiscussed", "Exclusivity discussed")], ["territory_discussed", t("neg.territoryDiscussed", "Territory discussed")]] as const).map(([k, label]) => {
                const on = d[k] as boolean;
                return <button key={k} type="button" onClick={() => set(k, !on)} className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${on ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{label}</button>;
              })}
            </div>
            <Field label={t("neg.fieldLeverageNotes", "Leverage points")}><textarea className={`${inputCls} min-h-[48px]`} value={d.leverage_notes} onChange={(e) => set("leverage_notes", e.target.value)} placeholder={t("neg.phLeverageNotes", "We are 60% of their export volume…")} /></Field>
            <Field label={t("neg.fieldRedFlags", "Red flags")}><textarea className={`${inputCls} min-h-[48px]`} value={d.red_flags} onChange={(e) => set("red_flags", e.target.value)} /></Field>
            <Field label={t("neg.fieldBehaviorNotes", "Behavior patterns")}><textarea className={`${inputCls} min-h-[48px]`} value={d.behavior_notes} onChange={(e) => set("behavior_notes", e.target.value)} placeholder={t("neg.phBehaviorNotes", "Holds firm early, concedes near quarter-end…")} /></Field>
            {err ? <div className="text-[12px] text-rose-400">{err}</div> : null}
            <div className="flex items-center gap-3">
              <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">{busy ? t("neg.saving", "Saving…") : t("neg.logRound", "Log round")}</button>
              <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text-secondary)]">{t("neg.cancel", "Cancel")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
