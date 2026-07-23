"use client";

/* ---------------------------------------------------------------------------
   HR › Skills — the "while they work here" half of the skills system.

   Hire-time scores are set in the employee form; here a manager or super
   admin RE-assesses them over time. The append-only employee_skill_history
   makes the comparison honest: for a chosen period (week / month / year) the
   baseline is the score as it stood at the period start, and every skill
   shows old → new with a delta. That per-period view IS the weekly /
   monthly / annual report.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import EmployeePicker from "@/components/hr/EmployeePicker";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import { usePermissions } from "@/lib/permissions";
import { levelForScore, summarize, gapStatus, type ScorableSkill } from "@/lib/skills/scoring";
import type { HRModuleProps } from "@/components/hr/HRApp";

interface Assessment { skill_id: string; source: string; employee_score: number | null; last_assessed_at: string | null }
interface HistoryRow { skill_id: string; employee_score: number | null; recorded_at: string }
interface Requirement { skill_id: string; required_score: number; weight: number; is_mandatory: boolean }
interface LibSkill { id: string; category_id: string; name: string }
interface LibCategory { id: string; name: string }

type Period = "weekly" | "monthly" | "annual";
const PERIOD_DAYS: Record<Period, number> = { weekly: 7, monthly: 30, annual: 365 };

export default function SkillsModule({ employees, t }: HRModuleProps) {
  const perms = usePermissions();
  const canEdit = perms.can("HR", "edit");

  const [employeeId, setEmployeeId] = useState("");
  const [period, setPeriod] = useState<Period>("monthly");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [libSkills, setLibSkills] = useState<LibSkill[]>([]);
  const [libCats, setLibCats] = useState<LibCategory[]>([]);
  /** Draft scores being edited — skill_id → score. */
  const [draft, setDraft] = useState<Map<string, number>>(new Map());

  /* Library once (names + categories for display). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/skills", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (cancelled) return;
      setLibSkills(json.skills ?? []);
      setLibCats(json.categories ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async (empId: string) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/hr/skills?employee_id=${empId}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "Failed to load"); return; }
      setAssessments(json.assessments ?? []);
      setHistory(json.history ?? []);
      setRequirements(json.requirements ?? []);
      setDraft(new Map());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (employeeId) void load(employeeId); }, [employeeId, load]);

  const skillName = useMemo(() => new Map(libSkills.map((s) => [s.id, s.name])), [libSkills]);
  const skillCat = useMemo(() => {
    const catName = new Map(libCats.map((c) => [c.id, c.name]));
    return new Map(libSkills.map((s) => [s.id, catName.get(s.category_id) ?? ""]));
  }, [libSkills, libCats]);
  const reqBySkill = useMemo(() => new Map(requirements.map((r) => [r.skill_id, r])), [requirements]);

  /* Baseline per skill = latest history row AT OR BEFORE the period start.
     No row that early → the skill has no baseline yet (shown as "new"). */
  const baseline = useMemo(() => {
    const cutoff = Date.now() - PERIOD_DAYS[period] * 24 * 3600 * 1000;
    const m = new Map<string, number | null>();
    for (const h of history) {                      // history is time-ascending
      if (new Date(h.recorded_at).getTime() <= cutoff) m.set(h.skill_id, h.employee_score);
    }
    return m;
  }, [history, period]);

  const effScore = useCallback(
    (a: Assessment) => (draft.has(a.skill_id) ? draft.get(a.skill_id)! : a.employee_score),
    [draft],
  );

  const toScorable = useCallback((a: Assessment): ScorableSkill => {
    const r = reqBySkill.get(a.skill_id);
    return {
      score: effScore(a),
      weight: r?.weight ?? 1,
      requiredScore: r ? r.required_score : null,
      isMandatory: r?.is_mandatory ?? false,
    };
  }, [reqBySkill, effScore]);

  /* Live summary: current vs baseline-period aggregate. */
  const report = useMemo(() => {
    const posRows = assessments.filter((a) => reqBySkill.has(a.skill_id));
    const addRows = assessments.filter((a) => !reqBySkill.has(a.skill_id));
    const cur = summarize(posRows.map(toScorable), addRows.map(toScorable));
    const baseScorable = (a: Assessment): ScorableSkill => ({
      score: baseline.has(a.skill_id) ? baseline.get(a.skill_id)! : null,
      weight: reqBySkill.get(a.skill_id)?.weight ?? 1,
      requiredScore: reqBySkill.get(a.skill_id)?.required_score ?? null,
    });
    const base = summarize(posRows.map(baseScorable), addRows.map(baseScorable));
    let improved = 0, declined = 0, unchanged = 0, fresh = 0;
    for (const a of assessments) {
      const now = effScore(a);
      if (now == null) continue;
      if (!baseline.has(a.skill_id) || baseline.get(a.skill_id) == null) { fresh++; continue; }
      const old = baseline.get(a.skill_id)!;
      if (now > old) improved++; else if (now < old) declined++; else unchanged++;
    }
    return { cur, base, improved, declined, unchanged, fresh };
  }, [assessments, reqBySkill, toScorable, baseline, effScore]);

  const save = async () => {
    if (!draft.size) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/hr/skills", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          scores: [...draft.entries()].map(([skill_id, employee_score]) => ({ skill_id, employee_score })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "Save failed"); return; }
      setSavedAt(json.updated ?? 0);
      await load(employeeId);                        // refresh history so deltas update
    } finally { setSaving(false); }
  };

  const sorted = useMemo(
    () => [...assessments].sort((a, b) => {
      const ra = reqBySkill.has(a.skill_id) ? 0 : 1;
      const rb = reqBySkill.has(b.skill_id) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return (skillName.get(a.skill_id) ?? "").localeCompare(skillName.get(b.skill_id) ?? "");
    }),
    [assessments, reqBySkill, skillName],
  );

  const periodLabel = period === "weekly" ? t("hr.skills.weekly") : period === "monthly" ? t("hr.skills.monthly") : t("hr.skills.annual");

  return (
    <div className="space-y-4">
      <style jsx global>{`
        .kx-skill-slider {
          -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px;
          background: linear-gradient(to right, var(--accent, #0066ff) var(--fill, 0%), var(--bg-surface-subtle) var(--fill, 0%));
          outline: none;
        }
        .kx-skill-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 9999px;
          background: #fff; border: 1px solid rgba(0,0,0,0.15); box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: pointer;
        }
        .kx-skill-slider::-moz-range-thumb {
          width: 16px; height: 16px; border-radius: 9999px; background: #fff;
          border: 1px solid rgba(0,0,0,0.15); box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: pointer;
        }
      `}</style>

      {/* ── Controls ── */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">{t("hr.skills.employee")}</label>
            <EmployeePicker
              employees={employees}
              value={employeeId}
              onChange={setEmployeeId}
              placeholder={t("hr.skills.pickEmployee")}
              searchPlaceholder={t("hr.skills.employee")}
              emptyLabel="—"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-dim)] mb-1">{t("hr.skills.reportPeriod")}</label>
            <div className="inline-flex rounded-lg bg-[var(--bg-surface-subtle)] p-0.5">
              {(["weekly", "monthly", "annual"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                  className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    period === p ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-faint)] hover:text-[var(--text-secondary)]"}`}
                >
                  {p === "weekly" ? t("hr.skills.weekly") : p === "monthly" ? t("hr.skills.monthly") : t("hr.skills.annual")}
                </button>
              ))}
            </div>
          </div>
        </div>
        {!canEdit && employeeId && (
          <p className="text-[11.5px] text-[var(--text-faint)]">{t("hr.skills.readOnly")}</p>
        )}
      </div>

      {!employeeId ? (
        <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-10 text-center text-[13px] text-[var(--text-faint)]">
          {t("hr.skills.pickEmployee")}
        </p>
      ) : loading ? (
        <div className="flex justify-center py-12"><SpinnerIcon size={20} className="animate-spin text-[var(--text-dim)]" /></div>
      ) : assessments.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-10 text-center text-[13px] text-[var(--text-faint)]">
          {t("hr.skills.none")}
        </p>
      ) : (
        <>
          {/* ── Report summary: current vs period baseline ── */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              {periodLabel} {t("hr.skills.report")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Card label={t("hr.skills.currentScore")} value={fmt(report.cur.positionScore)} />
              <Card label={t("hr.skills.previousScore")} value={fmt(report.base.positionScore)} />
              <Card
                label={t("hr.skills.change")}
                value={delta(report.cur.positionScore, report.base.positionScore)}
                tone={toneOf(report.cur.positionScore, report.base.positionScore)}
              />
              <Card label={t("hr.skills.improved")} value={String(report.improved)} tone={report.improved ? "good" : undefined} />
              <Card label={t("hr.skills.declined")} value={String(report.declined)} tone={report.declined ? "warn" : undefined} />
              <Card label={t("hr.skills.match")} value={report.cur.matchPct == null ? "—" : `${report.cur.matchPct}%`} />
              <Card label={t("hr.sk.coverage")} value={report.cur.coveragePct == null ? "—" : `${report.cur.coveragePct}%`} tone={report.cur.coveragePct != null && report.cur.coveragePct < 100 ? "warn" : undefined} />
            </div>
          </div>

          {/* ── Per-skill rows: old → new ── */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden divide-y divide-[var(--border-faint)]">
            {sorted.map((a) => {
              const cur = effScore(a);
              const old = baseline.has(a.skill_id) ? baseline.get(a.skill_id) : null;
              const req = reqBySkill.get(a.skill_id);
              const g = gapStatus(toScorable(a));
              return (
                <div key={a.skill_id} className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4 px-4 py-3">
                  <div className="lg:w-[230px] shrink-0 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] text-[var(--text-primary)] truncate">{skillName.get(a.skill_id) ?? "—"}</span>
                      {req?.is_mandatory && <span className="shrink-0 rounded bg-rose-500/12 px-1 py-px text-[9px] font-bold uppercase text-rose-600 dark:text-rose-400">Req</span>}
                    </div>
                    <div className="text-[10.5px] text-[var(--text-faint)]">
                      {skillCat.get(a.skill_id)}{req ? ` · ${t("hr.skills.required")} ${req.required_score}` : ` · ${t("hr.skills.additional")}`}
                    </div>
                  </div>

                  {/* old → new */}
                  <div className="flex items-center gap-2 shrink-0 lg:w-[150px]">
                    <span className="text-[12.5px] tabular-nums text-[var(--text-faint)] w-7 text-end">{old == null ? "—" : old}</span>
                    <span className="text-[var(--text-ghost)]">→</span>
                    <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary)] w-7">{cur == null ? "—" : cur}</span>
                    <DeltaBadge oldV={old ?? null} newV={cur} isNew={!baseline.has(a.skill_id)} t={t} />
                  </div>

                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input
                      type="range" min={0} max={100} step={1}
                      value={cur ?? 0}
                      disabled={!canEdit}
                      aria-label={`${skillName.get(a.skill_id) ?? "skill"} score`}
                      aria-valuetext={cur == null ? "Not assessed" : `${cur} — ${levelForScore(cur)}`}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setDraft((p) => new Map(p).set(a.skill_id, v));
                      }}
                      className="kx-skill-slider flex-1 min-w-[80px] disabled:opacity-50"
                      style={{ ["--fill" as string]: `${cur ?? 0}%` }}
                    />
                    <span className="w-[80px] shrink-0 text-[10.5px] font-medium text-[var(--text-muted)]">
                      {cur == null ? t("hr.skills.notAssessed") : levelForScore(cur)}
                    </span>
                    {g && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        g === "meets" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                        : g === "below" ? "bg-amber-500/12 text-amber-600 dark:text-amber-400"
                        : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]"}`}>
                        {g === "meets" ? t("hr.skills.meets") : g === "below" ? t("hr.skills.gap") : t("hr.skills.notAssessed")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Save ── */}
          {canEdit && (
            <div className="flex items-center justify-end gap-3">
              {error && <span className="text-[12px] text-rose-400">{error}</span>}
              {savedAt > 0 && !draft.size && (
                <span className="flex items-center gap-1 text-[12px] text-emerald-500"><CheckIcon size={12} />{t("hr.skills.saved")}</span>
              )}
              <button
                type="button"
                onClick={save}
                disabled={saving || !draft.size}
                className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? t("hr.skills.saving") : `${t("hr.skills.save")}${draft.size ? ` (${draft.size})` : ""}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function fmt(n: number | null) { return n == null ? "—" : String(n); }
function delta(cur: number | null, base: number | null) {
  if (cur == null || base == null) return "—";
  const d = cur - base;
  return d > 0 ? `+${d}` : String(d);
}
function toneOf(cur: number | null, base: number | null): "good" | "warn" | undefined {
  if (cur == null || base == null) return undefined;
  if (cur > base) return "good";
  if (cur < base) return "warn";
  return undefined;
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-xl bg-[var(--bg-surface-subtle)] px-3 py-2.5 text-center">
      <div className={`text-[16px] font-semibold tabular-nums ${
        tone === "good" ? "text-emerald-600 dark:text-emerald-400"
        : tone === "warn" ? "text-amber-600 dark:text-amber-400"
        : "text-[var(--text-primary)]"}`}>{value}</div>
      <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
    </div>
  );
}

function DeltaBadge({ oldV, newV, isNew, t }: { oldV: number | null; newV: number | null; isNew: boolean; t: (k: string) => string }) {
  if (newV == null) return null;
  if (isNew || oldV == null) {
    return <span className="shrink-0 rounded-full bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[var(--text-faint)]">{t("hr.skills.new")}</span>;
  }
  const d = newV - oldV;
  if (d === 0) return null;
  return (
    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold tabular-nums ${
      d > 0 ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/12 text-rose-600 dark:text-rose-400"}`}>
      {d > 0 ? `↑ +${d}` : `↓ ${d}`}
    </span>
  );
}
