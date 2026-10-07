"use client";

/* ---------------------------------------------------------------------------
   Ratings — the monthly scoring workspace (plan §E.1).

   One screen, one request: the cycle detail carries items with names,
   per-employee progress, and the cycle's state. Scoring is a batch PUT of
   dirty rows on blur/Enter; extremes (<30 / >90) demand an evidence note —
   the server refuses without it, the form asks inline first.

   States: no cycle → open this month. scoring → full editing. review →
   read-only + HR's reopen/finalize. finalized → publish. published → the
   month is done.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HRModuleProps } from "../HRApp";
import { cardCls, inputCls, primaryBtnCls, cancelBtnCls } from "../shared";
import BrandLoading from "@/components/ui/BrandLoading";
import { useConfirm } from "@/components/kds/useConfirm";

type Cycle = {
  id: string; month: string; status: string;
  config: { skills?: number; behavior?: number };
};
type Item = {
  id: string; employee_id: string; item_kind: "skill" | "behavior";
  ref_id: string; scope: string; required_score: number | null;
  weight: number; is_mandatory: boolean; score: number | null;
  comment: string | null; evidence: string | null;
  name: string; name_zh: string | null; name_ar: string | null;
};
type Progress = Record<string, { total: number; scored: number; missingMandatory: number }>;

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-slate-500/15 text-slate-400 border-slate-500/20",
  scoring:   "bg-blue-500/15 text-blue-400 border-blue-500/20",
  review:    "bg-amber-500/15 text-amber-400 border-amber-500/20",
  finalized: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  published: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

export default function RatingsModule({ employees, t, lang }: HRModuleProps) {
  const { askConfirm, confirmDialog } = useConfirm();
  const [cycles, setCycles] = useState<Cycle[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [progress, setProgress] = useState<Progress>({});
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Map<string, { score: number | null; comment?: string; evidence?: string }>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);

  const loadCycles = useCallback(async () => {
    const res = await fetch("/api/hr/ratings/cycles");
    const j = await res.json().catch(() => null);
    const list: Cycle[] = j?.cycles ?? [];
    setCycles(list);
    if (list.length > 0 && !activeId) setActiveId(list[0].id);
  }, [activeId]);

  const loadCycle = useCallback(async (id: string) => {
    const res = await fetch(`/api/hr/ratings/cycles/${id}`);
    const j = await res.json().catch(() => null);
    if (!j?.cycle) return;
    setCycle(j.cycle);
    setItems(j.items ?? []);
    setProgress(j.progress ?? {});
    setDirty(new Map());
    setSelectedEmp((prev) => prev ?? j.items?.[0]?.employee_id ?? null);
  }, []);

  useEffect(() => { void loadCycles(); }, [loadCycles]);
  useEffect(() => { if (activeId) void loadCycle(activeId); }, [activeId, loadCycle]);

  const empName = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.person?.full_name ?? e.person?.first_name ?? "—");
    return m;
  }, [employees]);

  const empItems = useMemo(() => items.filter((i) => i.employee_id === selectedEmp), [items, selectedEmp]);
  const itemName = useCallback((i: Item) =>
    lang === "zh" ? (i.name_zh ?? i.name) : lang === "ar" ? (i.name_ar ?? i.name) : i.name, [lang]);

  const scoring = cycle?.status === "scoring";
  const totals = useMemo(() => {
    let total = 0, scored = 0, gaps = 0;
    for (const p of Object.values(progress)) { total += p.total; scored += p.scored; gaps += p.missingMandatory; }
    return { total, scored, gaps };
  }, [progress]);

  async function openCurrentMonth() {
    setBusy("open");
    setError(null);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const res = await fetch("/api/hr/ratings/cycles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const j = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(j?.error ?? t("hr.ratings.error")); return; }
    await loadCycles();
    if (j?.cycle?.id) setActiveId(j.cycle.id);
  }

  async function transition(action: string) {
    if (!cycle) return;
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/hr/ratings/cycles/${cycle.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(j?.error ?? t("hr.ratings.error")); return; }
    await loadCycle(cycle.id);
    await loadCycles();
  }

  function markDirty(item: Item, patch: { score: number | null; comment?: string; evidence?: string }) {
    setDirty((prev) => {
      const next = new Map(prev);
      const cur = next.get(item.id) ?? { score: item.score, comment: item.comment ?? undefined, evidence: item.evidence ?? undefined };
      next.set(item.id, { ...cur, ...patch });
      return next;
    });
  }

  async function save() {
    if (!cycle || dirty.size === 0) return;
    setBusy("save");
    setError(null);
    const scores = [...dirty.entries()].map(([item_id, v]) => ({
      item_id, score: v.score, comment: v.comment, evidence: v.evidence,
    }));
    const res = await fetch(`/api/hr/ratings/cycles/${cycle.id}/items`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores }),
    });
    const j = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) { setError(j?.error ?? t("hr.ratings.error")); return; }
    await loadCycle(cycle.id);
  }

  /* ── render ── */

  if (cycles === null) return <div className="py-16 flex justify-center"><BrandLoading /></div>;

  if (cycles.length === 0) {
    return (
      <div className={`${cardCls} p-10 text-center space-y-4`}>
        <p className="text-[15px] font-semibold text-[var(--text-primary)]">{t("hr.ratings.empty.title")}</p>
        <p className="text-[13px] text-[var(--text-dim)]">{t("hr.ratings.empty.hint")}</p>
        <button type="button" onClick={() => void openCurrentMonth()} disabled={busy === "open"} className={primaryBtnCls}>
          {busy === "open" ? "…" : t("hr.ratings.open")}
        </button>
        {error && <p className="text-[12px] text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      {/* cycle strip */}
      <div className="flex items-center gap-2 flex-wrap">
        {cycles.map((c) => (
          <button key={c.id} type="button" onClick={() => setActiveId(c.id)}
            className={`h-9 px-4 rounded-xl text-[13px] font-medium border transition-colors ${
              c.id === activeId
                ? "border-[var(--border-focus)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            }`}>
            {c.month.slice(0, 7)}
            <span className={`ms-2 px-1.5 py-0.5 rounded-md text-[10px] border ${STATUS_BADGE[c.status] ?? STATUS_BADGE.draft}`}>
              {t(`hr.ratings.status.${c.status}`)}
            </span>
          </button>
        ))}
      </div>

      {cycle && (
        <div className={cardCls}>
          {/* progress header */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border-faint)] flex-wrap">
            <div className="flex items-center gap-4">
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                {t("hr.ratings.progress")}: {totals.scored}/{totals.total}
              </p>
              {totals.gaps > 0 && (
                <p className="text-[12px] text-amber-400">
                  {totals.gaps} {t("hr.ratings.missingMandatory")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {scoring && dirty.size > 0 && (
                <button type="button" onClick={() => void save()} disabled={busy === "save"} className={primaryBtnCls}>
                  {busy === "save" ? "…" : `${t("hr.ratings.save")} (${dirty.size})`}
                </button>
              )}
              {scoring && (
                <button type="button" disabled={busy !== null}
                  onClick={() => askConfirm(t("hr.ratings.confirm.review"), () => void transition("start_review"), { confirmLabel: t("hr.ratings.startReview"), cancelLabel: t("confirm.cancel") })}
                  className={cancelBtnCls}>
                  {t("hr.ratings.startReview")}
                </button>
              )}
              {cycle.status === "review" && (
                <>
                  <button type="button" disabled={busy !== null} onClick={() => void transition("reopen_scoring")} className={cancelBtnCls}>
                    {t("hr.ratings.reopen")}
                  </button>
                  <button type="button" disabled={busy !== null}
                    onClick={() => askConfirm(t("hr.ratings.confirm.finalize"), () => void transition("finalize"), { confirmLabel: t("hr.ratings.finalize"), cancelLabel: t("confirm.cancel") })}
                    className={primaryBtnCls}>
                    {busy === "finalize" ? "…" : t("hr.ratings.finalize")}
                  </button>
                </>
              )}
              {cycle.status === "finalized" && (
                <button type="button" disabled={busy !== null}
                  onClick={() => askConfirm(t("hr.ratings.confirm.publish"), () => void transition("publish"), { confirmLabel: t("hr.ratings.publish"), cancelLabel: t("confirm.cancel") })}
                  className={primaryBtnCls}>
                  {busy === "publish" ? "…" : t("hr.ratings.publish")}
                </button>
              )}
            </div>
          </div>
          {error && <p className="px-5 py-2 text-[12px] text-red-400 border-b border-[var(--border-faint)]">{error}</p>}

          {/* employee chips */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--border-faint)] overflow-x-auto">
            {Object.keys(progress).map((empId) => {
              const p = progress[empId];
              const pct = p.total ? Math.round((p.scored / p.total) * 100) : 0;
              return (
                <button key={empId} type="button" onClick={() => setSelectedEmp(empId)}
                  className={`shrink-0 h-9 px-3.5 rounded-xl border text-[12px] font-medium transition-colors ${
                    empId === selectedEmp
                      ? "border-[var(--border-focus)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  }`}>
                  {empName.get(empId) ?? "—"}
                  <span className="ms-2 text-[10px] opacity-70">{pct}%</span>
                  {p.missingMandatory > 0 && <span className="ms-1 text-amber-400">●</span>}
                </button>
              );
            })}
          </div>

          {/* the item table for the selected employee */}
          <div className="divide-y divide-[var(--border-faint)]">
            {empItems.map((item, idx) => {
              const d = dirty.get(item.id);
              const value = d ? d.score : item.score;
              const extreme = value !== null && (value < 30 || value > 90);
              return (
                <div key={item.id} className="px-5 py-2.5 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-[11px] text-[var(--text-dim)] tabular-nums">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-[var(--text-primary)] truncate">
                      {itemName(item)}
                      {item.is_mandatory && <span className="ms-1.5 text-amber-400" title={t("hr.ratings.mandatory")}>★</span>}
                    </p>
                    <p className="text-[10px] text-[var(--text-dim)]">
                      {t(`hr.ratings.kind.${item.item_kind}`)} · {t(`hr.ratings.scope.${item.scope}`)}
                      {item.required_score !== null && ` · ${t("hr.ratings.required")} ${item.required_score}`}
                      {item.weight !== 1 && ` · ×${item.weight}`}
                    </p>
                  </div>
                  {noteFor === item.id ? (
                    <input
                      autoFocus
                      defaultValue={d?.comment ?? item.comment ?? ""}
                      placeholder={t("hr.ratings.comment.ph")}
                      className={`${inputCls} w-44`}
                      onBlur={(e) => { markDirty(item, { score: value ?? null, comment: e.target.value }); setNoteFor(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setNoteFor(null); }}
                    />
                  ) : (
                    <button type="button" onClick={() => setNoteFor(item.id)}
                      className={`text-[11px] ${(d?.comment ?? item.comment) ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"} hover:underline`}
                      disabled={!scoring}>
                      {(d?.comment ?? item.comment) ? "✎" : `+ ${t("hr.ratings.comment")}`}
                    </button>
                  )}
                  <input
                    type="number" min={0} max={100} inputMode="numeric"
                    value={value ?? ""}
                    disabled={!scoring}
                    placeholder="—"
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Math.min(100, Math.max(0, Math.round(Number(e.target.value))));
                      markDirty(item, { score: v });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                        const next = e.currentTarget.closest(".divide-y")?.querySelectorAll("input[type=number]");
                        if (next) { const arr = [...next] as HTMLInputElement[]; const i = arr.indexOf(e.currentTarget as HTMLInputElement); arr[i + 1]?.focus(); }
                      }
                    }}
                    className={`${inputCls} w-20 text-center tabular-nums ${
                      value !== null && item.required_score !== null
                        ? value >= item.required_score ? "border-emerald-500/40" : "border-red-500/40"
                        : ""
                    }`}
                  />
                </div>
                {extreme && scoring && (
                  <input
                    defaultValue={d?.evidence ?? item.evidence ?? ""}
                    placeholder={t("hr.ratings.evidence.ph")}
                    onBlur={(e) => markDirty(item, { score: value ?? null, evidence: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    className={`${inputCls} border-amber-500/40 text-[12px]`}
                  />
                )}
                </div>
              );
            })}
            {empItems.length === 0 && (
              <p className="px-5 py-8 text-center text-[13px] text-[var(--text-dim)]">{t("hr.ratings.noItems")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
