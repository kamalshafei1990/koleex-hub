"use client";

/* ---------------------------------------------------------------------------
   AssetReview — the "Review" tab of the Asset Workspace (10th tab).

   Turns the passive registry into an operational approval workflow. It reads
   the deterministic recommendation (computed server-side from Quality + DNA +
   Governance + duplicate + collection signals), lets a reviewer score the
   15-item checklist, record a decision (approve / approve-with-notes / needs-
   revision / replace-recommended / deprecate / reject), leave reviewer notes,
   link a replacement asset, and surfaces production-safety warnings. Every
   decision is persisted + logged to the asset History timeline. KOLEEX dark.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import type {
  ReviewRecommendation, AssetReview as AssetReviewRow, ReviewChecklist,
  ReviewScore, ReviewStatus, ReviewPriority,
} from "@/lib/visual-library/types";
import { REVIEW_STATUS_LABEL, REVIEW_PRIORITIES } from "@/lib/visual-library/types";
import { RISK_TONE, reviewStatusTone } from "@/lib/visual-library/review";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import BadgeCheckIcon from "@/components/icons/ui/BadgeCheckIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";

interface Resp {
  recommendation: ReviewRecommendation;
  review: AssetReviewRow | null;
  checklists: ReviewChecklist[];
  scores: ReviewScore[];
}
interface SearchAsset { id: string; title: string; visual_asset_code: string; public_url: string | null }

const toneText = (t: "positive" | "warning" | "rose" | "neutral") =>
  t === "positive" ? "text-emerald-400" : t === "warning" ? "text-amber-400" : t === "rose" ? "text-rose-400" : "text-[var(--text-muted)]";
const toneStroke = (t: "positive" | "warning" | "rose") => t === "positive" ? "#34d399" : t === "warning" ? "#fbbf24" : "#fb7185";

const DECISIONS: { status: ReviewStatus; label: string }[] = [
  { status: "approved", label: "Approve" },
  { status: "approved_with_notes", label: "Approve w/ notes" },
  { status: "needs_revision", label: "Needs revision" },
  { status: "replace_recommended", label: "Replace recommended" },
  { status: "deprecated", label: "Deprecate" },
  { status: "rejected", label: "Reject" },
];

export default function AssetReview({
  asset, onOpenAsset, onChanged,
}: { asset: { id: string; title: string; public_url?: string | null }; onOpenAsset?: (id: string) => void; onChanged?: () => void }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // editable state
  const [scores, setScores] = useState<Record<string, { score: number; passed: boolean }>>({});
  const [priority, setPriority] = useState<ReviewPriority>("medium");
  const [notes, setNotes] = useState("");
  const [internal, setInternal] = useState("");
  const [replacement, setReplacement] = useState<SearchAsset | null>(null);
  const [picker, setPicker] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/visual-library/${asset.id}/review`, { credentials: "include", cache: "no-store" });
      const j: Resp = res.ok ? await res.json() : null as never;
      if (j) {
        setData(j);
        // hydrate editable state from saved review + scores, else from defaults
        const map: Record<string, { score: number; passed: boolean }> = {};
        for (const c of j.checklists) {
          const existing = j.scores.find((s) => s.checklist_id === c.id);
          map[c.id] = existing ? { score: existing.score, passed: existing.passed } : { score: 0, passed: false };
        }
        setScores(map);
        setPriority((j.review?.review_priority as ReviewPriority) ?? "medium");
        setNotes(j.review?.reviewer_notes ?? "");
        setInternal(j.review?.internal_notes ?? "");
        if (j.review?.replacement_asset_id) {
          // shallow-load the linked replacement's label
          fetch(`/api/visual-library/${j.review.replacement_asset_id}`, { credentials: "include", cache: "no-store" })
            .then((r) => r.ok ? r.json() : null).then((rr) => {
              const a = rr?.asset ?? rr;
              if (a?.id) setReplacement({ id: a.id, title: a.title, visual_asset_code: a.visual_asset_code, public_url: a.public_url ?? null });
            }).catch(() => {});
        } else setReplacement(null);
      }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [asset.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setScore = (id: string, patch: Partial<{ score: number; passed: boolean }>) =>
    setScores((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  const decide = async (review_status: ReviewStatus) => {
    if (!data) return;
    setSaving(review_status);
    const body = {
      review_status, review_priority: priority,
      reviewer_notes: notes, internal_notes: internal,
      replacement_asset_id: replacement?.id ?? null,
      scores: data.checklists.map((c) => ({ checklist_id: c.id, score: scores[c.id]?.score ?? 0, passed: scores[c.id]?.passed ?? false })),
    };
    await fetch(`/api/visual-library/${asset.id}/review`, {
      method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(null);
    await load();
    onChanged?.();
  };

  if (loading) return <div className="flex justify-center py-10 text-[var(--text-dim)]"><SpinnerIcon size={18} className="animate-spin" /></div>;
  if (!data) return <p className="py-8 text-center text-[12.5px] text-[var(--text-dim)]">Couldn’t load the review.</p>;

  const reco = data.recommendation;
  const riskTone = RISK_TONE[reco.risk_level];
  const review = data.review;
  const errors = reco.safety.filter((s) => s.severity === "error");
  const warnings = reco.safety.filter((s) => s.severity === "warning");
  // weighted checklist completion
  const totalW = data.checklists.reduce((s, c) => s + (c.weight || 1), 0) || 1;
  const passW = data.checklists.reduce((s, c) => s + (scores[c.id]?.passed ? (c.weight || 1) : 0), 0);
  const checkPct = Math.round((passW / totalW) * 100);

  return (
    <div className="space-y-5">
      {/* 1 · Recommendation hero */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-4">
          <Gauge value={reco.approval_score} tone={riskTone} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[13px] font-semibold ${toneText(reviewStatusTone(review?.review_status ?? reco.suggested_status))}`}>
                {REVIEW_STATUS_LABEL[review?.review_status ?? reco.suggested_status]}
              </span>
              {review ? (
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-dim)]">decided</span>
              ) : (
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-dim)]">suggested</span>
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-muted)]">{reco.recommendation}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px]">
              <Pill label="Risk" value={reco.risk_level} tone={toneText(riskTone)} />
              <Pill label="Production" value={reco.production_ready ? "ready" : "not ready"} tone={reco.production_ready ? "text-emerald-400" : "text-amber-400"} />
              <Pill label="Checklist" value={`${checkPct}%`} tone={checkPct >= 80 ? "text-emerald-400" : checkPct >= 50 ? "text-amber-400" : "text-rose-400"} />
            </div>
          </div>
          <button type="button" onClick={load} title="Recompute"
            className="self-start rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <RefreshCwIcon size={13} />
          </button>
        </div>
      </div>

      {/* 2 · Production safety warnings */}
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="space-y-1.5">
          {errors.map((w, i) => (
            <div key={`e${i}`} className="flex items-start gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-[11.5px] text-rose-300">
              <TriangleWarningIcon size={13} className="mt-px shrink-0" /><span>{w.message}</span>
            </div>
          ))}
          {warnings.map((w, i) => (
            <div key={`w${i}`} className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-300">
              <TriangleWarningIcon size={13} className="mt-px shrink-0" /><span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 3 · Interactive checklist */}
      <Section title={`Review checklist · ${checkPct}%`}>
        <div className="space-y-1">
          {data.checklists.map((c) => {
            const v = scores[c.id] ?? { score: 0, passed: false };
            return (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5">
                <button type="button" onClick={() => setScore(c.id, { passed: !v.passed, score: !v.passed ? Math.max(v.score, 80) : v.score })}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${v.passed ? "border-emerald-400 bg-emerald-400 text-black" : "border-[var(--border-color)] text-transparent"}`}>
                  <BadgeCheckIcon size={11} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] text-[var(--text-primary)]">{c.name}</span>
                    {c.required && <span className="shrink-0 rounded-full bg-rose-500/10 px-1.5 py-px text-[9px] font-semibold uppercase text-rose-300">req</span>}
                  </div>
                  {c.category && <span className="text-[9.5px] uppercase tracking-wide text-[var(--text-dim)]">{c.category}</span>}
                </div>
                <input type="range" min={0} max={100} step={5} value={v.score}
                  onChange={(e) => setScore(c.id, { score: Number(e.target.value), passed: Number(e.target.value) >= 70 })}
                  className="h-1 w-20 accent-[var(--accent)]" />
                <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-[var(--text-dim)]">{v.score}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 4 · Reviewer notes + priority */}
      <Section title="Reviewer notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes shown on the review record…"
          className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
        <textarea value={internal} onChange={(e) => setInternal(e.target.value)} rows={1} placeholder="Internal notes (not customer-facing)…"
          className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-wide text-[var(--text-dim)]">Priority</span>
          {REVIEW_PRIORITIES.map((p) => (
            <button key={p} type="button" onClick={() => setPriority(p)}
              className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium capitalize transition-colors ${priority === p ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>{p}</button>
          ))}
        </div>
      </Section>

      {/* 5 · Replacement linking */}
      <Section title="Replacement asset">
        {replacement ? (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 pl-1.5 pr-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-neutral-900">
              {replacement.public_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={replacement.public_url} alt="" className="h-5 w-5 object-contain" />
              ) : null}
            </span>
            <button type="button" onClick={() => onOpenAsset?.(replacement.id)} className="min-w-0 flex-1 text-left">
              <div className="truncate text-[12px] text-[var(--text-primary)]">{replacement.title}</div>
              <div className="font-mono text-[10px] text-[var(--text-dim)]">{replacement.visual_asset_code}</div>
            </button>
            <button type="button" onClick={() => setReplacement(null)} className="text-[var(--text-dim)] hover:text-rose-400"><CrossIcon size={13} /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setPicker(true)}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)] hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]">
            Link a replacement asset
          </button>
        )}
      </Section>

      {/* 6 · Decision buttons */}
      <Section title="Decision">
        <div className="grid grid-cols-2 gap-1.5">
          {DECISIONS.map((d) => {
            const tone = reviewStatusTone(d.status);
            const active = review?.review_status === d.status;
            return (
              <button key={d.status} type="button" disabled={!!saving} onClick={() => decide(d.status)}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11.5px] font-semibold transition-colors disabled:opacity-50
                  ${active ? "border-transparent bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                    : `border-[var(--border-subtle)] ${toneText(tone)} hover:border-[var(--border-color)]`}`}>
                {saving === d.status ? <SpinnerIcon size={12} className="animate-spin" /> : null}{d.label}
              </button>
            );
          })}
        </div>
        {review?.reviewed_at && (
          <p className="mt-2 text-[10.5px] text-[var(--text-dim)]">Last decision {new Date(review.reviewed_at).toLocaleString()} · score {review.approval_score} · {review.risk_level} risk</p>
        )}
      </Section>

      {picker && <ReplacementPicker excludeId={asset.id} onClose={() => setPicker(false)} onPick={(a) => { setReplacement(a); setPicker(false); }} />}
    </div>
  );
}

/* ── Replacement picker modal ── */
function ReplacementPicker({ excludeId, onClose, onPick }: { excludeId: string; onClose: () => void; onPick: (a: SearchAsset) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchAsset[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    let alive = true; setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/visual-library?q=${encodeURIComponent(q.trim())}&approval_status=approved&pageSize=10`, { credentials: "include", cache: "no-store" })
        .then((r) => r.ok ? r.json() : { assets: [] })
        .then((j) => { if (alive) setResults((j.assets ?? []).filter((a: SearchAsset) => a.id !== excludeId)); })
        .catch(() => {}).finally(() => { if (alive) setLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, excludeId]);
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center bg-black/60 pt-24" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">Link replacement (approved assets)</span>
          <button type="button" onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]"><CrossIcon size={14} /></button>
        </div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…"
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] placeholder:text-[var(--text-dim)]" />
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {loading ? <div className="flex justify-center py-4 text-[var(--text-dim)]"><SpinnerIcon size={14} className="animate-spin" /></div>
            : results.length === 0 ? <p className="py-4 text-center text-[11.5px] text-[var(--text-dim)]">{q.trim().length < 2 ? "Type to search…" : "No approved matches."}</p>
            : results.map((a) => (
              <button key={a.id} type="button" onClick={() => onPick(a)}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 pl-1.5 pr-2.5 text-left hover:border-[var(--border-color)]">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-neutral-900">
                  {a.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.public_url} alt="" className="h-5 w-5 object-contain" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[12px] text-[var(--text-primary)]">{a.title}</span><span className="font-mono text-[10px] text-[var(--text-dim)]">{a.visual_asset_code}</span></span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

/* ── primitives ── */
function Gauge({ value, tone }: { value: number; tone: "positive" | "warning" | "rose" }) {
  const r = 26, c = 2 * Math.PI * r, off = c - (value / 100) * c;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border-color)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={toneStroke(tone)} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[17px] font-bold tabular-nums ${toneText(tone)}`}>{value}</span>
    </div>
  );
}
function Pill({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5">
      <span className="text-[var(--text-dim)]">{label}</span><span className={`font-semibold capitalize ${tone}`}>{value}</span>
    </span>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div {...kxInspectAttrs({ component: "AssetReviewTab", module: "Database", section: "Review" })}>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{title}</h4>
      {children}
    </div>
  );
}
