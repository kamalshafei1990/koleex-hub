"use client";

/* ---------------------------------------------------------------------------
   Shared Behavior & Conduct UI primitives — used by the employee-form tab and
   the HR Behavior module so the slider, level colours, library picker and
   position-requirements configurator behave identically everywhere.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { behaviorLevel, type BehaviorLevel } from "@/lib/behavior/scoring";
import { useTranslation } from "@/lib/i18n";
import { hrT } from "@/lib/translations/hr";

/** Behaviour level → translation key, so the slider label localises. */
const LEVEL_KEY: Record<BehaviorLevel, string> = {
  Exemplary: "hr.bhv.lvExemplary",
  Strong: "hr.bhv.lvStrong",
  Acceptable: "hr.bhv.lvAcceptable",
  "Needs Improvement": "hr.bhv.lvNeedsImprovement",
  Poor: "hr.bhv.lvPoor",
  Unacceptable: "hr.bhv.lvUnacceptable",
};

export interface BehaviorCategory { id: string; name: string; sort_order: number }
export interface BehaviorIndicator { id: string; category_id: string; name: string; description?: string | null; assessor_guidance?: string | null; is_critical_default: boolean; sort_order: number }
export interface BehaviorRequirement {
  behavior_indicator_id: string; required_score: number; weight: number;
  is_mandatory: boolean; is_critical: boolean; notes: string | null; sort_order: number;
}

/** Slider fill colour follows the behaviour band, so the bar itself signals
    "acceptable" vs "poor" — not just the number. */
export function levelColor(level: BehaviorLevel): string {
  switch (level) {
    case "Exemplary": return "#0066ff";
    case "Strong": return "#10b981";
    case "Acceptable": return "#22c55e";
    case "Needs Improvement": return "#f59e0b";
    case "Poor": return "#f97316";
    case "Unacceptable": return "#ef4444";
  }
}

/* Shared slider CSS — inject once per page. */
export function BehaviorSliderStyles() {
  return (
    <style jsx global>{`
      .kx-bhv-slider {
        -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px;
        background: linear-gradient(to right, var(--bhv-fill, #0066ff) var(--fill, 0%), var(--bg-surface-subtle) var(--fill, 0%));
        outline: none;
      }
      .kx-bhv-slider::-webkit-slider-thumb {
        -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 9999px;
        background: #fff; border: 1px solid rgba(0,0,0,0.15); box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: pointer;
      }
      .kx-bhv-slider::-moz-range-thumb {
        width: 16px; height: 16px; border-radius: 9999px; background: #fff;
        border: 1px solid rgba(0,0,0,0.15); box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: pointer;
      }
      .kx-bhv-slider:disabled { opacity: 0.5; }
      .kx-bhv-slider:focus-visible { box-shadow: 0 0 0 2px var(--accent, #0066ff); }
    `}</style>
  );
}

export function BehaviorSlider({
  value, onChange, label, disabled,
}: {
  value: number | null;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation(hrT);
  const v = value ?? 0;
  const level = value == null ? null : behaviorLevel(v);
  const levelLabel = level ? t(LEVEL_KEY[level]) : "";
  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <input
        type="range" min={0} max={100} step={1} value={v} disabled={disabled}
        aria-label={`${label} behavior score`}
        aria-valuetext={value == null ? t("hr.bhv.notAssessed") : `${v} — ${levelLabel}`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="kx-bhv-slider flex-1 min-w-[80px]"
        style={{ ["--fill" as string]: `${v}%`, ["--bhv-fill" as string]: level ? levelColor(level) : "#94a3b8" }}
      />
      <span className="w-8 text-end text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
        {value == null ? "—" : v}
      </span>
      <span className={`w-[118px] shrink-0 text-[10.5px] font-medium ${value == null ? "text-[var(--text-faint)]" : "text-[var(--text-muted)]"}`}>
        {value == null ? t("hr.bhv.notAssessed") : levelLabel}
      </span>
    </div>
  );
}

/* ═══ Indicator picker — search + category filter over the library ═══ */
export function BehaviorPicker({
  categories, indicators, excludeIds, onPick, onClose,
}: {
  categories: BehaviorCategory[];
  indicators: BehaviorIndicator[];
  excludeIds: Set<string>;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(hrT);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const q = query.trim().toLowerCase();
  const list = indicators.filter(
    (s) => !excludeIds.has(s.id) &&
      (!catFilter || s.category_id === catFilter) &&
      (!q || s.name.toLowerCase().includes(q)),
  ).slice(0, 150);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t("hr.bhv.addIndicatorTitle")}
      >
        <div className="p-4 border-b border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">{t("hr.bhv.addIndicatorTitle")}</h3>
            <button type="button" onClick={onClose} aria-label={t("hr.bhv.close")} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><CrossIcon size={13} /></button>
          </div>
          <div className="relative">
            <SearchIcon size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("hr.bhv.searchIndicators")}
              className="w-full h-9 ps-8 pe-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--border-focus)]" />
          </div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label={t("hr.bhv.allCategories")}
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none">
            <option value="">{t("hr.bhv.allCategories")}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {list.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12.5px] text-[var(--text-faint)]">{t("hr.bhv.noMatching")}</p>
          ) : list.map((s) => (
            <button key={s.id} type="button" onClick={() => onPick(s.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start hover:bg-[var(--bg-surface-hover)] transition-colors">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-[13px] text-[var(--text-primary)] truncate">{s.name}</span>
                {s.is_critical_default && <span className="shrink-0 rounded bg-rose-500/12 px-1 py-px text-[9px] font-bold uppercase text-rose-600 dark:text-rose-400">{t("hr.bhv.critical")}</span>}
              </span>
              <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{catName(s.category_id)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ Position behavior requirements configurator ═══ */
export function PositionBehaviorConfig({
  positionId, categories, indicators, onClose,
}: {
  positionId: string;
  categories: BehaviorCategory[];
  indicators: BehaviorIndicator[];
  onClose: () => void;
}) {
  const { t } = useTranslation(hrT);
  const [reqs, setReqs] = useState<BehaviorRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const indById = useMemo(() => new Map(indicators.map((s) => [s.id, s])), [indicators]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/positions/${positionId}/behavior`, { credentials: "include" });
      const json = await res.json().catch(() => ({ requirements: [] }));
      if (!cancelled) { setReqs(json.requirements ?? []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [positionId]);

  const upd = (id: string, patch: Partial<BehaviorRequirement>) =>
    setReqs(reqs.map((r) => (r.behavior_indicator_id === id ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/positions/${positionId}/behavior`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements: reqs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || t("hr.bhv.saveFailed")); return; }
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t("hr.bhv.posReqTitle")}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div>
            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">{t("hr.bhv.posReqTitle")}</h3>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">{t("hr.bhv.posReqSubtitle")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("hr.bhv.close")} className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><CrossIcon size={13} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><SpinnerIcon size={18} className="animate-spin text-[var(--text-dim)]" /></div>
          ) : reqs.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-[var(--text-faint)]">{t("hr.bhv.noRequirements")}</p>
          ) : reqs.map((r) => (
            <div key={r.behavior_indicator_id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5">
              <span className="min-w-[140px] flex-1 text-[13px] text-[var(--text-primary)] truncate">{indById.get(r.behavior_indicator_id)?.name ?? t("hr.bhv.unknown")}</span>
              <label className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-faint)]">{t("hr.bhv.required")}
                <input type="number" min={0} max={100} value={r.required_score}
                  onChange={(e) => upd(r.behavior_indicator_id, { required_score: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                  className="w-14 h-8 px-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] text-center outline-none" /></label>
              <label className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-faint)]">{t("hr.bhv.weight")}
                <input type="number" min={0} max={99} step={0.5} value={r.weight}
                  onChange={(e) => upd(r.behavior_indicator_id, { weight: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-14 h-8 px-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] text-center outline-none" /></label>
              <button type="button" onClick={() => upd(r.behavior_indicator_id, { is_mandatory: !r.is_mandatory })}
                className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${r.is_mandatory ? "bg-amber-500/12 text-amber-700 dark:text-amber-400" : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]"}`}>
                {r.is_mandatory ? t("hr.bhv.mandatory") : t("hr.bhv.optional")}
              </button>
              <button type="button" onClick={() => upd(r.behavior_indicator_id, { is_critical: !r.is_critical })}
                className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${r.is_critical ? "bg-rose-500/12 text-rose-600 dark:text-rose-400" : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]"}`}>
                {r.is_critical ? t("hr.bhv.critical") : t("hr.bhv.nonCritical")}
              </button>
              <button type="button" onClick={() => setReqs(reqs.filter((x) => x.behavior_indicator_id !== r.behavior_indicator_id))}
                aria-label={t("hr.bhv.removeRequirement")}
                className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <CrossIcon size={10} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            <span className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center"><PlusIcon size={11} /></span>
            {t("hr.bhv.addFromLibrary")}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 p-4 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] text-rose-400">{error}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] text-[12.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">{t("hr.bhv.cancel")}</button>
            <button type="button" onClick={save} disabled={saving || loading}
              className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving ? t("hr.bhv.saving") : t("hr.bhv.saveRequirements")}
            </button>
          </div>
        </div>
        {pickerOpen && (
          <BehaviorPicker categories={categories} indicators={indicators}
            excludeIds={new Set(reqs.map((r) => r.behavior_indicator_id))}
            onPick={(id) => setReqs([...reqs, {
              behavior_indicator_id: id, required_score: 70, weight: 1,
              is_mandatory: false, is_critical: indById.get(id)?.is_critical_default ?? false,
              notes: null, sort_order: reqs.length * 10,
            }])}
            onClose={() => setPickerOpen(false)} />
        )}
      </div>
    </div>
  );
}
