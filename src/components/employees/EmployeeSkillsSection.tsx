"use client";

/* ---------------------------------------------------------------------------
   Employee Skills section — used inside EmployeeForm (add AND edit).

   Structure: Company Skill Library → categories → skills → position skill
   requirements → employee assessments. The form never shows the whole
   library; it shows the skills the selected POSITION requires, plus whatever
   was added deliberately for this employee. The library only appears inside
   the "add skill" picker, searched and filtered.

   State contract with the form: the assessments live in the wizard as ONE
   JSON string (`form.skills`) — same pattern as social_accounts — so save,
   cancel and warm-start all keep working without knowing about skills.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CogIcon from "@/components/icons/ui/CogIcon";
import {
  levelForScore, gapStatus, summarize, type ScorableSkill,
} from "@/lib/skills/scoring";

/* ── Library shapes (from /api/skills) ── */
export interface SkillCategory { id: string; name: string; sort_order: number }
export interface Skill { id: string; category_id: string; name: string; sort_order: number }
export interface PositionRequirement {
  skill_id: string; required_score: number; weight: number;
  is_mandatory: boolean; notes: string | null; sort_order: number;
}
/** One row of form state — serialised into form.skills. */
export interface AssessmentRow {
  skill_id: string;
  source: "position" | "additional";
  employee_score: number | null;
  years_of_experience: number | null;
  notes: string | null;
}

/* ═══ Score slider — accent-blue fill, white knob (Hub standing rule) ═══ */
function SkillSlider({
  value, onChange, label,
}: {
  /** null = unassessed. Moving the slider assesses. */
  value: number | null;
  onChange: (v: number) => void;
  label: string;
}) {
  const v = value ?? 0;
  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={v}
        aria-label={`${label} score`}
        aria-valuetext={value == null ? "Not assessed" : `${v} — ${levelForScore(v)}`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="kx-skill-slider flex-1 min-w-[90px]"
        style={{ ["--fill" as string]: `${v}%` }}
      />
      <span className="w-8 text-end text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
        {value == null ? "—" : v}
      </span>
      <span className={`w-[86px] shrink-0 text-[10.5px] font-medium ${
        value == null ? "text-[var(--text-faint)]" : "text-[var(--text-muted)]"}`}>
        {value == null ? "Not assessed" : levelForScore(v)}
      </span>
    </div>
  );
}

function GapBadge({ row }: { row: ScorableSkill }) {
  const g = gapStatus(row);
  if (!g) return null;
  const cls =
    g === "meets" ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
    : g === "below" ? "bg-amber-500/12 text-amber-600 dark:text-amber-400"
    : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]";
  const label = g === "meets" ? "Meets" : g === "below" ? "Gap" : "Not assessed";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{label}</span>;
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
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

/* ═══ Main section ═══ */
export default function EmployeeSkillsSection({
  positionId, value, onChange, canConfigurePosition,
}: {
  positionId: string;
  /** form.skills — JSON string of AssessmentRow[]. */
  value: string;
  onChange: (v: string) => void;
  canConfigurePosition: boolean;
}) {
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [requirements, setRequirements] = useState<PositionRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const rows = useMemo<AssessmentRow[]>(() => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [value]);
  const setRows = useCallback(
    (next: AssessmentRow[]) => onChange(JSON.stringify(next)),
    [onChange],
  );

  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const reqBySkill = useMemo(() => new Map(requirements.map((r) => [r.skill_id, r])), [requirements]);

  /* ── Library (once) ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/skills", { credentials: "include" });
        const json = await res.json();
        if (cancelled) return;
        setCategories(json.categories ?? []);
        setSkills(json.skills ?? []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Position requirements: refetch when the position changes, then
        reconcile the assessment rows.
        · requirement gained → a 'position' row appears (unassessed)
        · requirement lost, NO score → the row silently disappears
        · requirement lost, HAS score → the row is PRESERVED as 'additional';
          an assessed skill is a fact about the person, not about the chair
          they happen to sit in. Nothing is silently deleted.               ── */
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    let cancelled = false;
    if (!positionId) {
      setRequirements([]);
      /* Position cleared: demote scored position rows, drop unscored ones. */
      const cur = rowsRef.current;
      const next = cur
        .filter((r) => !(r.source === "position" && r.employee_score == null))
        .map((r) => (r.source === "position" ? { ...r, source: "additional" as const } : r));
      if (JSON.stringify(next) !== JSON.stringify(cur)) setRows(next);
      return;
    }
    (async () => {
      const res = await fetch(`/api/positions/${positionId}/skills`, { credentials: "include" });
      const json = await res.json().catch(() => ({ requirements: [] }));
      if (cancelled) return;
      const reqs: PositionRequirement[] = json.requirements ?? [];
      setRequirements(reqs);

      const reqIds = new Set(reqs.map((r) => r.skill_id));
      const cur = rowsRef.current;
      const next: AssessmentRow[] = [];
      const have = new Set<string>();
      for (const r of cur) {
        have.add(r.skill_id);
        if (reqIds.has(r.skill_id)) {
          next.push({ ...r, source: "position" });          // promoted / confirmed
        } else if (r.source === "additional") {
          next.push(r);                                     // untouched
        } else if (r.employee_score != null) {
          next.push({ ...r, source: "additional" });        // preserved, demoted
        }
        /* else: position row, no score → dropped */
      }
      for (const req of reqs) {
        if (!have.has(req.skill_id)) {
          next.push({
            skill_id: req.skill_id, source: "position",
            employee_score: null, years_of_experience: null, notes: null,
          });
        }
      }
      if (JSON.stringify(next) !== JSON.stringify(cur)) setRows(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionId, configOpen === false ? 0 : 1]); // refetch after the config modal closes

  const positionRows = rows.filter((r) => r.source === "position");
  const additionalRows = rows.filter((r) => r.source === "additional");

  const toScorable = useCallback((r: AssessmentRow): ScorableSkill => {
    const req = reqBySkill.get(r.skill_id);
    return {
      score: r.employee_score,
      weight: req?.weight ?? 1,
      requiredScore: req ? req.required_score : null,
      isMandatory: req?.is_mandatory ?? false,
    };
  }, [reqBySkill]);

  /* Live summary — recomputed on every slider move; nothing persisted. */
  const summary = useMemo(
    () => summarize(positionRows.map(toScorable), additionalRows.map(toScorable)),
    [positionRows, additionalRows, toScorable],
  );

  const setScore = (skillId: string, score: number) =>
    setRows(rows.map((r) => (r.skill_id === skillId ? { ...r, employee_score: score } : r)));
  const removeRow = (skillId: string) => setRows(rows.filter((r) => r.skill_id !== skillId));
  const addSkill = (skillId: string) => {
    if (rows.some((r) => r.skill_id === skillId)) return;  // duplicate guard
    setRows([...rows, {
      skill_id: skillId, source: "additional",
      employee_score: null, years_of_experience: null, notes: null,
    }]);
  };

  /* Group position rows by category for the collapsible headers. */
  const grouped = useMemo(() => {
    const byCat = new Map<string, AssessmentRow[]>();
    for (const r of positionRows) {
      const cat = skillById.get(r.skill_id)?.category_id ?? "?";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(r);
    }
    return [...byCat.entries()].sort(
      (a, b) => (catById.get(a[0])?.sort_order ?? 0) - (catById.get(b[0])?.sort_order ?? 0),
    );
  }, [positionRows, skillById, catById]);

  const toggleCat = (id: string) =>
    setCollapsed((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <SpinnerIcon size={18} className="animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Slider styling: accent-blue fill via a gradient stop, white knob. */}
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
        .kx-skill-slider:focus-visible { box-shadow: 0 0 0 2px var(--accent, #0066ff); }
      `}</style>

      {/* ── A. Position skills ── */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Position Skills
          </h4>
          {canConfigurePosition && positionId && (
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
            >
              <CogIcon size={12} />
              Configure position skills
            </button>
          )}
        </div>

        {!positionId ? (
          <p className="rounded-xl bg-[var(--bg-surface-subtle)]/60 px-4 py-6 text-center text-[12.5px] text-[var(--text-faint)]">
            Select a position first — its required skills load here automatically.
          </p>
        ) : requirements.length === 0 ? (
          <p className="rounded-xl bg-[var(--bg-surface-subtle)]/60 px-4 py-6 text-center text-[12.5px] text-[var(--text-faint)]">
            This position has no configured skills yet.
            {canConfigurePosition && " Use “Configure position skills” to define them once — every employee in the position inherits them."}
          </p>
        ) : (
          <div className="space-y-2">
            {grouped.map(([catId, catRows]) => {
              const cat = catById.get(catId);
              const scorables = catRows.map(toScorable);
              const assessed = scorables.filter((s) => s.score != null).length;
              const gaps = scorables.filter((s) => gapStatus(s) === "below").length;
              const open = !collapsed.has(catId);
              return (
                <div key={catId} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCat(catId)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 bg-[var(--bg-surface-subtle)]/40 px-3.5 py-2.5 text-start hover:bg-[var(--bg-surface-subtle)]/70 transition-colors"
                  >
                    <span className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                      {cat?.name ?? "Other"}
                    </span>
                    <span className="flex items-center gap-2 shrink-0 text-[10.5px] text-[var(--text-faint)]">
                      <span>{assessed}/{catRows.length} assessed</span>
                      {gaps > 0 && (
                        <span className="rounded-full bg-amber-500/12 px-1.5 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                          {gaps} gap{gaps > 1 ? "s" : ""}
                        </span>
                      )}
                      <AngleDownIcon size={12} className={`transition-transform ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
                    </span>
                  </button>
                  {open && (
                    <div className="divide-y divide-[var(--border-faint)]">
                      {catRows.map((r) => {
                        const sk = skillById.get(r.skill_id);
                        const req = reqBySkill.get(r.skill_id);
                        return (
                          <div key={r.skill_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3.5 py-2.5">
                            <div className="sm:w-[220px] shrink-0 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] text-[var(--text-primary)] truncate">{sk?.name ?? "Unknown skill"}</span>
                                {req?.is_mandatory && (
                                  <span className="shrink-0 rounded bg-rose-500/12 px-1 py-px text-[9px] font-bold uppercase text-rose-600 dark:text-rose-400">Req</span>
                                )}
                              </div>
                              <div className="text-[10.5px] text-[var(--text-faint)]">
                                Required: {req?.required_score ?? "—"}
                              </div>
                            </div>
                            <SkillSlider value={r.employee_score} onChange={(v) => setScore(r.skill_id, v)} label={sk?.name ?? "skill"} />
                            <GapBadge row={toScorable(r)} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── B. Additional skills ── */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Additional Skills
          </h4>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span className="w-5 h-5 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center"><PlusIcon size={10} /></span>
            Add skill
          </button>
        </div>
        {additionalRows.length === 0 ? (
          <p className="text-[12px] text-[var(--text-faint)]">
            No additional skills. Add anything this person can do beyond the position requirements.
          </p>
        ) : (
          <div className="rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-faint)]">
            {additionalRows.map((r) => {
              const sk = skillById.get(r.skill_id);
              return (
                <div key={r.skill_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3.5 py-2.5">
                  <div className="sm:w-[220px] shrink-0 min-w-0">
                    <span className="text-[13px] text-[var(--text-primary)] truncate block">{sk?.name ?? "Unknown skill"}</span>
                    <span className="text-[10.5px] text-[var(--text-faint)]">
                      {catById.get(sk?.category_id ?? "")?.name ?? ""}
                    </span>
                  </div>
                  <SkillSlider value={r.employee_score} onChange={(v) => setScore(r.skill_id, v)} label={sk?.name ?? "skill"} />
                  <button
                    type="button"
                    onClick={() => removeRow(r.skill_id)}
                    aria-label={`Remove ${sk?.name ?? "skill"}`}
                    className="shrink-0 w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <CrossIcon size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── C. Live summary ── */}
      {(positionRows.length > 0 || additionalRows.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryCard label="Position Score" value={summary.positionScore == null ? "—" : String(summary.positionScore)} />
          <SummaryCard label="Required Avg" value={summary.requiredScore == null ? "—" : String(summary.requiredScore)} />
          <SummaryCard
            label="Skill Match"
            value={summary.matchPct == null ? "—" : `${summary.matchPct}%`}
            tone={summary.matchPct == null ? undefined : summary.matchPct >= 100 ? "good" : summary.matchPct < 70 ? "warn" : undefined}
          />
          <SummaryCard label="Additional Score" value={summary.additionalScore == null ? "—" : String(summary.additionalScore)} />
          <SummaryCard label="Overall Score" value={summary.overallScore == null ? "—" : String(summary.overallScore)} />
          <SummaryCard label="Meets" value={String(summary.meets)} tone={summary.meets > 0 ? "good" : undefined} />
          <SummaryCard label="Below" value={String(summary.below)} tone={summary.below > 0 ? "warn" : undefined} />
          <SummaryCard label="Mandatory Gaps" value={String(summary.mandatoryGaps)} tone={summary.mandatoryGaps > 0 ? "warn" : "good"} />
        </div>
      )}

      {pickerOpen && (
        <SkillPicker
          categories={categories}
          skills={skills}
          excludeIds={new Set(rows.map((r) => r.skill_id))}
          onPick={(id) => { addSkill(id); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {configOpen && positionId && (
        <PositionSkillsConfig
          positionId={positionId}
          categories={categories}
          skills={skills}
          onClose={() => setConfigOpen(false)}
        />
      )}
    </div>
  );
}

/* ═══ Skill picker modal — search + category filter over the library ═══ */
function SkillPicker({
  categories, skills, excludeIds, onPick, onClose,
}: {
  categories: SkillCategory[];
  skills: Skill[];
  excludeIds: Set<string>;
  onPick: (skillId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const q = query.trim().toLowerCase();
  const list = skills.filter(
    (s) => !excludeIds.has(s.id) &&
      (!catFilter || s.category_id === catFilter) &&
      (!q || s.name.toLowerCase().includes(q)),
  ).slice(0, 120);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Add skill"
      >
        <div className="p-4 border-b border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Add Skill</h3>
            <button type="button" onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><CrossIcon size={13} /></button>
          </div>
          <div className="relative">
            <SearchIcon size={13} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills…"
              className="w-full h-9 ps-8 pe-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            aria-label="Filter by category"
            className="w-full h-9 px-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {list.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12.5px] text-[var(--text-faint)]">No matching skills.</p>
          ) : list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              <span className="text-[13px] text-[var(--text-primary)]">{s.name}</span>
              <span className="text-[10.5px] text-[var(--text-faint)] shrink-0">{catName(s.category_id)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ Position skills configurator — the requirement template editor.
   Lives here (reached from the form) because the Hub has no standalone
   position-management UI to host it; when one exists this modal moves there
   unchanged. Saving affects EVERY employee holding the position. ═══ */
function PositionSkillsConfig({
  positionId, categories, skills, onClose,
}: {
  positionId: string;
  categories: SkillCategory[];
  skills: Skill[];
  onClose: () => void;
}) {
  const [reqs, setReqs] = useState<PositionRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/positions/${positionId}/skills`, { credentials: "include" });
      const json = await res.json().catch(() => ({ requirements: [] }));
      if (!cancelled) { setReqs(json.requirements ?? []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [positionId]);

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/positions/${positionId}/skills`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements: reqs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error || "Save failed"); return; }
      onClose();
    } finally { setSaving(false); }
  };

  const upd = (skillId: string, patch: Partial<PositionRequirement>) =>
    setReqs(reqs.map((r) => (r.skill_id === skillId ? { ...r, ...patch } : r)));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Configure position skills"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div>
            <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Position Skill Requirements</h3>
            <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
              Applies to every employee in this position — not just this one.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><CrossIcon size={13} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8"><SpinnerIcon size={18} className="animate-spin text-[var(--text-dim)]" /></div>
          ) : reqs.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-[var(--text-faint)]">No requirements yet — add skills from the library.</p>
          ) : reqs.map((r) => (
            <div key={r.skill_id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5">
              <span className="min-w-[140px] flex-1 text-[13px] text-[var(--text-primary)] truncate">
                {skillById.get(r.skill_id)?.name ?? "Unknown"}
              </span>
              <label className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-faint)]">
                Required
                <input
                  type="number" min={0} max={100}
                  value={r.required_score}
                  onChange={(e) => upd(r.skill_id, { required_score: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                  className="w-14 h-8 px-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] text-center outline-none"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-faint)]">
                Weight
                <input
                  type="number" min={0} max={99} step={0.5}
                  value={r.weight}
                  onChange={(e) => upd(r.skill_id, { weight: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-14 h-8 px-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] text-center outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => upd(r.skill_id, { is_mandatory: !r.is_mandatory })}
                className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                  r.is_mandatory
                    ? "bg-rose-500/12 text-rose-600 dark:text-rose-400"
                    : "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]"}`}
              >
                {r.is_mandatory ? "Mandatory" : "Optional"}
              </button>
              <button
                type="button"
                onClick={() => setReqs(reqs.filter((x) => x.skill_id !== r.skill_id))}
                aria-label="Remove requirement"
                className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <CrossIcon size={10} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span className="w-6 h-6 rounded-full bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] flex items-center justify-center"><PlusIcon size={11} /></span>
            Add skill from library
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-[var(--border-subtle)]">
          <span className="text-[11px] text-rose-400">{error}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] text-[12.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">Cancel</button>
            <button
              type="button" onClick={save} disabled={saving || loading}
              className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save requirements"}
            </button>
          </div>
        </div>

        {pickerOpen && (
          <SkillPicker
            categories={categories}
            skills={skills}
            excludeIds={new Set(reqs.map((r) => r.skill_id))}
            onPick={(id) => setReqs([...reqs, {
              skill_id: id, required_score: 60, weight: 1,
              is_mandatory: false, notes: null, sort_order: reqs.length * 10,
            }])}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
