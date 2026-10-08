"use client";

/* ---------------------------------------------------------------------------
   Reports — the Team tab's summary (Phase 5A, owner's pick: "read + send
   up"). Its own chunk, loaded when the Team tab opens.

   The manager picks the days (today, yesterday, this week, last week, this
   month); Koleex AI reads what the team SENT in them — everyone under the
   manager, at every level; never a draft, never a confidential report — and
   answers a summary in the manager's language, beside each person's numbers
   (reports on time / late / missing, late / absent / leave days, open /
   overdue / done work). Nothing is stored: the last answer for each span is
   kept for this session, so coming back shows it at once. "Make it a
   report" opens a Team summary report for those days with the summary in
   it — the manager edits it and sends it up.

   6E: the weekly summary switch — every Monday at 07:00 the week that
   ended, written by Koleex AI into a draft in My reports; each manager
   switches it on for themself (their own schedule row, nobody else's).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RrIcon from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import type { Lang } from "@/lib/i18n";
import { reportTeamT } from "@/lib/translations/report-team";
import { TEAM_PERIODS, rangeLabel, teamPeriod, type TeamPeriodKey, type TeamPersonFacts } from "@/lib/reports/team";
import { createReport, fetchTeamSummary, fetchTeamWeekly, localToday, saveDraft, saveTeamWeekly, type TeamSummaryResult, type TeamWeekly } from "@/lib/work-reports";
import { CARD, type T } from "./shared";

const SEL = "kx-seg-on border-[#567FB2]/50 bg-[#567FB2]/12 text-[var(--text-primary)]";
const OFF = "kx-seg-off border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]";
const BTN = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50";
const CACHE = "kx:reports:team:";

type Kept = TeamSummaryResult & { at: string };

const readKept = (key: string): Kept | null => {
  try { const raw = sessionStorage.getItem(CACHE + key); return raw ? (JSON.parse(raw) as Kept) : null; } catch { return null; }
};

/** 6E: "Weekly summary" — the manager's own; the row is there from the first
 *  paint (the switch waits, disabled, for its state), so nothing moves. */
function WeeklySwitch({ t }: { t: T }) {
  const [state, setState] = useState<TeamWeekly | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void Promise.resolve().then(async () => { const res = await fetchTeamWeekly(); if (res.ok) setState(res.data); }); }, []);
  const on = !!state?.on;
  const flip = async () => {
    if (!state?.available) return;
    setBusy(true); setFailed(false);
    const res = await saveTeamWeekly(!on);
    setBusy(false);
    if (res.ok) setState(res.data); else setFailed(true);
  };
  return (
    <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{t("team.weekly")}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-dim)]">{t("team.weekly.hint")}</p>
        {failed && <p role="alert" className="mt-1 text-[11.5px] text-red-500">{t("team.weekly.failed")}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={t("team.weekly")} disabled={!state?.available || busy} onClick={() => void flip()}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60 ${on ? "bg-emerald-500" : "bg-[var(--bg-surface)] ring-1 ring-inset ring-[var(--border-subtle)]"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200 ${on ? "start-[22px]" : "start-0.5"}`} />
      </button>
    </div>
  );
}

export default function TeamSummary({ t: shared, lang }: { t: T; lang: string }) {
  const l = ((["en", "zh", "ar"] as const).find((x) => x === lang) ?? "en") as Lang;
  const t = useCallback<T>((key, fallback) => {
    const e = reportTeamT[key];
    return e ? (e[l] ?? e.en) : shared(key, fallback);
  }, [shared, l]);
  const router = useRouter();
  const today = useMemo(() => localToday(), []);
  const [period, setPeriod] = useState<TeamPeriodKey>("today");
  const range = teamPeriod(period, today);
  const key = `${range.from}|${range.to}|${l}`;
  const [results, setResults] = useState<Record<string, Kept | null>>(() => ({ [key]: readKept(key) }));
  const result = key in results ? results[key] : readKept(key);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const summarize = async () => {
    setBusy("sum"); setProblem(null); setCopied(false);
    const res = await fetchTeamSummary(range.from, range.to, l);
    setBusy(null);
    if (!res.ok) {
      setProblem(res.status === 429 ? t("team.err.busy") : res.error === "no_team" ? t("team.err.noTeam") : t("team.err.failed"));
      return;
    }
    const kept: Kept = { ...res.data, at: new Date().toISOString() };
    setResults((r) => ({ ...r, [key]: kept }));
    try { sessionStorage.setItem(CACHE + key, JSON.stringify(kept)); } catch { /* storage full or blocked */ }
  };

  /* A Team summary report for those days, the summary in it — opened as a
     draft the manager edits and sends up. */
  const makeReport = async () => {
    if (!result?.text) return;
    setBusy("make"); setProblem(null);
    const created = await createReport("team_summary", range.from, { lang: l });
    if (!created.ok) { setBusy(null); setProblem(t("team.err.failed")); return; }
    const saved = await saveDraft(created.data.id, { dateTo: range.to, sections: [{ id: "summary", text: result.text }] });
    if (!saved.ok) { setBusy(null); setProblem(t("team.err.failed")); return; }
    router.push(`/reports/${created.data.id}`);
  };

  const copy = async () => {
    if (!result?.text) return;
    try { await navigator.clipboard.writeText(result.text); setCopied(true); } catch { /* clipboard blocked */ }
  };

  const fill = (k: string, v: Record<string, number>) => Object.entries(v).reduce((s, [a, n]) => s.replace(`{${a}}`, String(n)), t(k));
  const at = result ? new Date(result.at) : null;

  return (
    <section className={`${CARD} mb-4 p-4 sm:p-5`} aria-labelledby="kx-team-sum">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[70ch]">
          <h2 id="kx-team-sum" className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text-primary)]"><RrIcon name="users" size={14} />{t("team.title")}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-dim)]">{t("team.lead")}</p>
        </div>
        <button type="button" disabled={!!busy} onClick={() => void summarize()} className={`kx-ai-glow ${BTN} border-[#567FB2]/40`}>
          {busy === "sum" ? <SpinnerIcon size={11} /> : <RrIcon name="bulb" size={11} />}{result ? t("team.again") : t("team.go")}
        </button>
      </div>

      <WeeklySwitch t={t} />

      <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("team.title")}>
        {TEAM_PERIODS.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={period === p} disabled={!!busy} onClick={() => { setPeriod(p); setProblem(null); setCopied(false); }}
            className={`h-7 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors ${period === p ? SEL : OFF}`}>
            {t(`team.p.${p}`)}
          </button>
        ))}
        <span className="self-center ps-1 text-[11.5px] tabular-nums text-[var(--text-faint)]">{rangeLabel(range.from, range.to)}</span>
      </div>

      {problem && <p className="mt-3 text-[12.5px] text-amber-500">{problem}</p>}
      {busy === "sum" ? (
        <p className="mt-4 flex items-center gap-2 text-[12.5px] text-[var(--text-dim)]"><SpinnerIcon size={12} />{t("team.busy")}</p>
      ) : !result ? (
        <p className="mt-4 text-[12.5px] text-[var(--text-faint)]">{t("team.empty")}</p>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-[11.5px] tabular-nums text-[var(--text-faint)]">
            {fill("team.meta", { n: result.reports, m: result.people })}
            {result.truncated ? ` · ${fill("team.truncated", { n: result.reports })}` : ""}
            {at ? ` · ${t("team.at").replace("{time}", `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`)}` : ""}
          </p>
          {result.text ? <SummaryText text={result.text} /> : <p className="text-[13px] text-[var(--text-dim)]">{t("team.none")}</p>}

          {result.facts.length > 0 && (
            <div>
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <span className={`inline-block transition-transform ${open ? "rotate-90" : "rtl:rotate-180"}`}><AngleRightIcon size={10} /></span>{t("team.numbers")}
              </button>
              {open && <Numbers t={t} facts={result.facts} tracking={result.tracking} fill={fill} />}
            </div>
          )}

          {result.text && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!!busy} onClick={() => void makeReport()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 text-[12px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">
                {busy === "make" ? <SpinnerIcon size={11} /> : <RrIcon name="paper-plane" size={11} />}{t("team.make")}
              </button>
              <button type="button" onClick={() => void copy()} className={BTN}><RrIcon name="file" size={11} />{copied ? t("team.copied") : t("team.copy")}</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** The summary as written: a label line, "- " items as a list, the rest as
 *  paragraphs — in its own direction (Arabic reads right to left). */
function SummaryText({ text }: { text: string }) {
  const blocks: Array<{ kind: "p" | "label" | "list"; lines: string[] }> = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const item = /^[-•*]\s+/.test(line);
    const last = blocks[blocks.length - 1];
    if (item) {
      if (last?.kind === "list") last.lines.push(line.replace(/^[-•*]\s+/, ""));
      else blocks.push({ kind: "list", lines: [line.replace(/^[-•*]\s+/, "")] });
    } else blocks.push({ kind: line.endsWith(":") || line.endsWith("：") ? "label" : "p", lines: [line] });
  }
  return (
    <div dir="auto" className="space-y-2 text-[13.5px] leading-relaxed text-[var(--text-primary)]">
      {blocks.map((b, i) => b.kind === "list" ? (
        <ul key={i} className="list-disc space-y-1 ps-5">{b.lines.map((x, j) => <li key={j}>{x}</li>)}</ul>
      ) : b.kind === "label" ? (
        <p key={i} className="pt-1 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--text-dim)]">{b.lines[0]}</p>
      ) : (
        <p key={i}>{b.lines[0]}</p>
      ))}
    </div>
  );
}

function Numbers({ t, facts, tracking, fill }: { t: T; facts: TeamPersonFacts[]; tracking: boolean; fill: (k: string, v: Record<string, number>) => string }) {
  const reports = (p: TeamPersonFacts) => (p.reports?.expected ? fill("team.cell.reports", { a: p.reports.onTime, b: p.reports.late, c: p.reports.missing }) : tracking ? t("team.cell.nothingDue") : t("team.cell.untracked"));
  const attendance = (p: TeamPersonFacts) => (p.attendance ? fill("team.cell.attendance", { a: p.attendance.late, b: p.attendance.absent, c: p.attendance.leave }) : "—");
  const work = (p: TeamPersonFacts) => fill("team.cell.work", { a: p.workload.open, b: p.workload.overdue, c: p.workload.done });
  return (
    <>
      <ul className="mt-2 space-y-2 sm:hidden">
        {facts.map((p) => (
          <li key={p.accountId} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5 text-[12px]">
            <p className="font-semibold text-[var(--text-primary)]" dir="auto">{p.name}</p>
            <dl className="mt-1 space-y-0.5 text-[var(--text-secondary)]">
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-[var(--text-faint)]">{t("team.col.reports")}</dt><dd>{reports(p)}</dd></div>
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-[var(--text-faint)]">{t("team.col.attendance")}</dt><dd>{attendance(p)}</dd></div>
              <div className="flex gap-2"><dt className="w-20 shrink-0 text-[var(--text-faint)]">{t("team.col.work")}</dt><dd>{work(p)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="mt-2 hidden overflow-x-auto sm:block">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[10.5px] font-semibold uppercase tracking-[0.04em] text-[var(--text-faint)]">
              {(["person", "reports", "attendance", "work"] as const).map((c) => <th key={c} className="px-2 py-1.5 text-start">{t(`team.col.${c}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {facts.map((p) => (
              <tr key={p.accountId} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-2 py-1.5 font-semibold text-[var(--text-primary)]" dir="auto">{p.name}</td>
                <td className="px-2 py-1.5 tabular-nums text-[var(--text-secondary)]">{reports(p)}</td>
                <td className="px-2 py-1.5 tabular-nums text-[var(--text-secondary)]">{attendance(p)}</td>
                <td className="px-2 py-1.5 tabular-nums text-[var(--text-secondary)]">{work(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
