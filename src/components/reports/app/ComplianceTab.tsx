"use client";

/* ---------------------------------------------------------------------------
   Reports → Compliance (Phase 3A): who was expected to send which report
   this week, and what happened — on the person's OWN calendar (their
   country's weekend and holidays, their leave, their end of day).

   One request per week shown (/api/work-reports/compliance). A super admin
   and HR see everyone; a manager their own people. Cells say whether a
   report was sent, never its text; a sent one links to it unless it was
   confidential. Until tracking starts nobody is marked late or missing —
   the setup (super admin / HR·edit) picks the day, and who writes what;
   before starting, the launch preview shows that first week as it would run.
   Loaded only when the tab opens (next/dynamic in ReportsApp).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RrIcon from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DatePicker from "@/components/ui/DatePicker";
import { addDays, localDayOf } from "@/lib/reports/obligations";
import type { Cell, CellState, ObligationKey, Obliged } from "@/lib/reports/obligations";
import {
  dmyDate, dmyTime, fetchCompliance, fetchLaunchPlan, fetchObligations, fetchSchedules, localToday, previewNudges, saveObligations, saveSchedule,
  type ComplianceBoard, type LaunchPlan, type NudgePreview, type ObligationSetup, type ReadinessRow, type ReportPerson, type ScheduleSetup as ScheduleData,
} from "@/lib/work-reports";
import { reportHead } from "@/lib/reports/catalog-heads";
import { periodFor } from "@/lib/reports/templates";
import { isScheduleCadence } from "@/lib/reports/schedules";
import { Avatar, CARD, FIELD, type T } from "./shared";
import type { Lang } from "@/lib/i18n";
import { reportComplianceT } from "@/lib/translations/report-ui/compliance";

const STATE_STYLE: Record<CellState, { cls: string; icon: React.ReactNode }> = {
  sent: { cls: "border-emerald-500/30 bg-emerald-500/12 text-emerald-500", icon: <RrIcon name="check" size={11} /> },
  late: { cls: "border-amber-500/35 bg-amber-500/12 text-amber-500", icon: <RrIcon name="clock" size={11} /> },
  missing: { cls: "border-red-500/35 bg-red-500/12 text-red-500", icon: <RrIcon name="cross" size={10} /> },
  due: { cls: "border-sky-500/40 bg-sky-500/10 text-sky-400", icon: <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> },
  upcoming: { cls: "border-[var(--border-subtle)] text-[var(--text-faint)]", icon: <span className="h-1 w-1 rounded-full bg-current" aria-hidden /> },
  off: { cls: "border-transparent text-[var(--text-faint)]", icon: <span aria-hidden>—</span> },
  leave: { cls: "border-violet-500/30 bg-violet-500/10 text-violet-400", icon: <RrIcon name="plane" size={11} /> },
  untracked: { cls: "border-dashed border-[var(--border-subtle)] text-[var(--text-faint)]", icon: <span className="h-1 w-1 rounded-full bg-current" aria-hidden /> },
};
const LEGEND: CellState[] = ["sent", "late", "missing", "due", "leave", "off", "untracked"];

function CellView({ t, cell, label }: { t: T; cell: Cell; label: string }) {
  const s = STATE_STYLE[cell.state];
  const facts = [t(`compliance.s.${cell.state}`), cell.sentAt ? t("compliance.sentAt").replace("{at}", dmyTime(cell.sentAt)) : "", cell.dueAt ? t("compliance.dueAt").replace("{at}", dmyTime(cell.dueAt)) : ""].filter(Boolean).join(" · ");
  const box = <span className={`mx-auto grid h-7 w-7 place-items-center rounded-lg border ${s.cls}`}>{s.icon}</span>;
  return cell.reportId && (cell.state === "sent" || cell.state === "late")
    ? <Link href={`/reports/${cell.reportId}`} title={`${label} · ${facts}`} aria-label={`${label}: ${facts}`} className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]">{box}</Link>
    : <span title={`${label} · ${facts}`} aria-label={`${label}: ${facts}`} className="block">{box}</span>;
}

export default function ComplianceTab({ t: shared, lang }: { t: T; lang: string }) {
  /* The board's own words ride this tab's chunk (./report-ui/compliance);
     everything else is the home's. */
  const t = useCallback<T>((key, fallback) => {
    const e = reportComplianceT[key];
    return e ? (e[lang as Lang] ?? e.en) : shared(key, fallback);
  }, [shared, lang]);
  const [day, setDay] = useState(() => localToday());
  const [board, setBoard] = useState<ComplianceBoard | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [setupOpen, setSetupOpen] = useState(false);

  const load = useCallback(async (d: string) => {
    setPhase("loading");
    const res = await fetchCompliance(d);
    if (res.ok) { setBoard(res.data); setPhase("ready"); } else setPhase("error");
  }, []);
  useEffect(() => { void Promise.resolve().then(() => load(day)); }, [day, load]);

  const weekday = (iso: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : lang === "zh" ? "zh-CN" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const s = board?.summary;
  const rate = s && s.onTime + s.late + s.missing > 0 ? Math.round((s.onTime / (s.onTime + s.late + s.missing)) * 100) : null;

  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{t("compliance.title")}</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">{t("compliance.hint")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-1">
              <button type="button" onClick={() => setDay((d) => addDays(d, -7))} aria-label={t("compliance.prev")} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]">
                <span className="inline-flex rtl:rotate-180"><RrIcon name="arrow-left" size={12} /></span>
              </button>
              <span className="min-w-[150px] px-1 text-center text-[12px] font-medium text-[var(--text-primary)] tabular-nums">
                {board ? `${dmyDate(board.week.days[0])} – ${dmyDate(board.week.days[6])}` : "…"}
              </span>
              <button type="button" onClick={() => setDay((d) => addDays(d, 7))} aria-label={t("compliance.next")} className="grid h-7 w-7 place-items-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]">
                <span className="inline-flex rotate-180 rtl:rotate-0"><RrIcon name="arrow-left" size={12} /></span>
              </button>
            </div>
            {board?.canSetUp && (
              <button type="button" onClick={() => setSetupOpen((v) => !v)} aria-expanded={setupOpen}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 text-[12.5px] font-medium text-[var(--text-primary)]">
                <RrIcon name="cog" size={13} />{t("compliance.setup")}
              </button>
            )}
          </div>
        </div>

        {s && (
          <div className="mt-4 flex flex-wrap gap-2 text-[12px]">
            {rate !== null && <span className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 font-semibold text-[var(--text-primary)] tabular-nums">{t("compliance.rate").replace("{n}", String(rate))}</span>}
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-500 tabular-nums">{t("compliance.s.sent")} {s.onTime}</span>
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-500 tabular-nums">{t("compliance.s.late")} {s.late}</span>
            <span className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-red-500 tabular-nums">{t("compliance.s.missing")} {s.missing}</span>
            <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-sky-400 tabular-nums">{t("compliance.s.due")} {s.due}</span>
          </div>
        )}

        {board && !board.trackingFrom && (
          <TrackingBanner t={t} lang={lang} canSetUp={board.canSetUp} onStarted={() => void load(day)} />
        )}
      </section>

      {/* Staff readiness: a super admin's — it arrives with the board, so nothing moves. */}
      {board?.readiness && board.readiness.length > 0 && <Readiness t={t} rows={board.readiness} trackingFrom={board.trackingFrom} />}

      {/* Keyed on the start date, so a start set from the banner shows here too. */}
      {setupOpen && board?.canSetUp && <Setup key={board.trackingFrom ?? "none"} t={t} lang={lang} onChanged={() => void load(day)} />}

      <section className={`${CARD} p-2 sm:p-3`}>
        {phase === "loading" && !board ? (
          <div className="grid place-items-center py-14"><SpinnerIcon size={18} /></div>
        ) : phase === "error" ? (
          <p className="px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">{t("err.generic")} <button type="button" onClick={() => void load(day)} className="ms-2 underline">↻</button></p>
        ) : board && board.rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] text-[var(--text-dim)]">{t("compliance.empty")}</p>
        ) : board ? (
          /* A wide table scrolls inside its own box; the name column stays. */
          <div className={`overflow-x-auto ${phase === "loading" ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[12px]">
              <thead>
                <tr className="text-[var(--text-dim)]">
                  <th className="sticky start-0 z-[1] bg-[var(--bg-surface)] px-3 py-2 text-start font-medium">{t("compliance.person")}</th>
                  {board.week.days.map((d) => (
                    <th key={d} className="px-1 py-2 text-center font-medium">
                      <span className="block">{weekday(d)}</span>
                      <span className="block text-[10.5px] text-[var(--text-faint)] tabular-nums">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
                    </th>
                  ))}
                  <th className="border-s border-[var(--border-subtle)] px-2 py-2 text-center font-medium">{t("compliance.weekly")}</th>
                  <th className="px-2 py-2 text-center font-medium">{t("compliance.monthly")}</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((r) => (
                  <tr key={r.person.id} className="border-t border-[var(--border-subtle)]">
                    <td className="sticky start-0 z-[1] bg-[var(--bg-surface)] px-3 py-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar person={r.person} size={24} />
                        <span className="min-w-0">
                          <span className="block max-w-[150px] truncate text-[12.5px] font-medium text-[var(--text-primary)]">{r.person.name}</span>
                          {r.person.position && <span className="block max-w-[150px] truncate text-[10.5px] text-[var(--text-dim)]">{r.person.position}</span>}
                        </span>
                      </span>
                    </td>
                    {board.week.days.map((d) => (
                      <td key={d} className="px-1 py-2 text-center">
                        {r.daily ? <CellView t={t} cell={r.daily[d]} label={`${t("tpl.daily.name")} ${dmyDate(d)}`} /> : <span className="text-[var(--text-faint)]">·</span>}
                      </td>
                    ))}
                    <td className="border-s border-[var(--border-subtle)] px-2 py-2 text-center">
                      {r.weekly ? <CellView t={t} cell={r.weekly} label={t("tpl.weekly.name")} /> : <span className="text-[var(--text-faint)]">·</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {r.monthly ? <CellView t={t} cell={r.monthly.cell} label={`${t("tpl.monthly.name")} ${r.monthly.month}`} /> : <span className="text-[var(--text-faint)]">·</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 pt-3 pb-1 text-[11px] text-[var(--text-dim)]">
          {LEGEND.map((st) => (
            <span key={st} className="inline-flex items-center gap-1.5">
              <span className={`grid h-4 w-4 place-items-center rounded border text-[9px] ${STATE_STYLE[st].cls}`}>{STATE_STYLE[st].icon}</span>{t(`compliance.s.${st}`)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

/* Before counting starts: pick the day, see that first week as it would run
   (the launch preview — read only), then start. The day offered is TOMORROW:
   started today, a report whose time has already passed would count as
   missing at once and its manager could hear of it within hours. */
function TrackingBanner({ t, lang, canSetUp, onStarted }: { t: T; lang: string; canSetUp: boolean; onStarted: () => void }) {
  const [date, setDate] = useState(() => addDays(localToday(), 1));
  const [busy, setBusy] = useState<"start" | "preview" | null>(null);
  const [problem, setProblem] = useState(false);
  const [plan, setPlan] = useState<LaunchPlan | null>(null);
  const start = async () => {
    setBusy("start"); setProblem(false);
    const res = await saveObligations({ trackingFrom: date });
    setBusy(null);
    if (res.ok) onStarted(); else setProblem(true);
  };
  const preview = async () => {
    setBusy("preview"); setProblem(false);
    const res = await fetchLaunchPlan(date);
    setBusy(null);
    if (res.ok) setPlan(res.data); else setProblem(true);
  };
  const past = date <= localToday();
  return (
    <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-[12.5px] text-[var(--text-secondary)]">
      <p>{t("compliance.notStarted")}</p>
      {canSetUp && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-[var(--text-dim)]">{t("compliance.startOn")}</span>
            {/* A preview belongs to its day: another day clears it. */}
            <div className="w-[170px]"><DatePicker id="kx-rep-track-from" value={date} onChange={(iso) => { if (iso) { setDate(iso); setPlan(null); } }} lang={lang} /></div>
            <button type="button" onClick={() => void preview()} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-[12.5px] font-medium text-[var(--text-primary)] disabled:opacity-60">
              {busy === "preview" ? <SpinnerIcon size={12} /> : <RrIcon name="eye" size={12} />}{t("launch.preview")}
            </button>
            <button type="button" onClick={() => void start()} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--bg-inverted)] px-3 text-[12.5px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">
              {busy === "start" && <SpinnerIcon size={12} />}{t("compliance.start")}
            </button>
            {problem && <span role="alert" className="text-[12px] text-red-500">{t("err.generic")}</span>}
          </div>
          {past && <p className="mt-2 text-[12px] text-amber-500">{t("launch.past")}</p>}
          {!plan && <p className="mt-1.5 text-[11.5px] text-[var(--text-dim)]">{t("launch.previewHint")}</p>}
          {plan && <LaunchPlanView t={t} lang={lang} plan={plan} />}
        </>
      )}
    </div>
  );
}

/** The launch preview, person by person: each report due on their own clock,
 *  the reminder, who hears of a missing one and when, and the days their
 *  calendar gives off — a holiday missing from it shows as a working day. */
function LaunchPlanView({ t, lang, plan }: { t: T; lang: string; plan: LaunchPlan }) {
  const loc = lang === "ar" ? "ar-EG" : lang === "zh" ? "zh-CN" : "en-GB";
  const dayText = (ymd: string) => `${new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`))} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
  /* Times on the author's own clock, Latin digits like the rest of the Hub. */
  const hm = (iso: string, tz: string) => {
    try { return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)); } catch { return iso.slice(11, 16); }
  };
  const zone = (tz: string) => {
    try { return new Intl.DateTimeFormat(loc, { timeZone: tz, timeZoneName: "long" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName")?.value ?? tz; } catch { return tz; }
  };
  /* Each name kept whole and isolated: a Latin name inside Arabic neither
     breaks across lines nor reorders the words around it. */
  const names = (list: ReportPerson[]) => list.map((x) => `\u2068${x.name.trim().replace(/\s+/g, "\u00a0")}\u2069`).join(lang === "ar" ? "، " : lang === "zh" ? "、" : ", ");
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{t("launch.title").replace("{from}", dmyDate(plan.first)).replace("{to}", dmyDate(plan.last))}</p>
      {plan.people.length === 0 ? <p className="text-[12px] text-[var(--text-dim)]">{t("launch.nobody")}</p> : plan.people.map((p) => (
        <div key={p.person.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar person={p.person} size={24} />
              <span className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{p.person.name}</span>
            </span>
            <span className="text-[11px] text-[var(--text-dim)]">{t("launch.clock").replace("{zone}", zone(p.tz)).replace("{time}", p.workEnd)}</span>
          </div>
          {p.startsOn && <p className="mt-1 text-[11.5px] text-[var(--text-dim)]">{t("launch.startsOn").replace("{day}", dayText(p.startsOn))}</p>}
          <p className="mt-1.5 text-[11.5px] text-[var(--text-dim)]">
            <span className="font-medium text-[var(--text-secondary)]">{t("launch.daysOff")}</span>{" "}
            {p.daysOff.length ? p.daysOff.map((d) => `${dayText(d.day)} (${t(`launch.off.${d.why}`)})`).join(" · ") : t("launch.noDaysOff")}
          </p>
          {p.items.length === 0 ? <p className="mt-1.5 text-[12px] text-[var(--text-dim)]">{t("launch.nothingDue")}</p> : (
            <ul className="mt-2 space-y-1.5">
              {p.items.map((it) => (
                <li key={`${it.key}|${it.periodKey}`} className="text-[12px] leading-snug">
                  <span className="text-[var(--text-primary)]">{t("launch.due").replace("{report}", t(`tpl.${it.key}.name`)).replace("{day}", dayText(it.dueDay)).replace("{time}", hm(it.dueAt, p.tz))}</span>
                  <span className="block text-[11.5px] text-[var(--text-dim)]">
                    {plan.reminders ? t("launch.remind").replace("{time}", hm(it.remindAt, p.tz)) : t("launch.remindOff")}
                    {" · "}
                    {!plan.escalations ? t("launch.escalateOff")
                      : !it.escalateAt || p.escalateTo.length === 0 ? t("launch.escalateNobody")
                        : t("launch.escalate").replace("{people}", names(p.escalateTo)).replace("{day}", dayText(localDayOf(it.escalateAt, p.tz))).replace("{time}", hm(it.escalateAt, p.tz))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p.noManager && plan.escalations && p.escalateTo.length > 0 && (
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-500">{t("launch.noManager").replace("{people}", names(p.escalateTo))}</p>
          )}
        </div>
      ))}
      {plan.exempt > 0 && <p className="text-[11.5px] text-[var(--text-dim)]">{t("launch.exempt").replace("{n}", String(plan.exempt))}</p>}
      <p className="text-[11.5px] text-[var(--text-dim)]">{t("launch.events")}</p>
      <p className="text-[11.5px] font-medium text-[var(--text-secondary)]">{t("launch.nothingSent")}</p>
    </div>
  );
}

/** Staff readiness (owner's pick 26/09/2026): can the reminder reach each
 *  person — the last day they used Koleex Hub, a device with notifications
 *  on — and have they sent a report yet. Amber is what to chase. */
function Readiness({ t, rows, trackingFrom }: { t: T; rows: ReadinessRow[]; trackingFrom: string | null }) {
  const today = localToday();
  const title = !trackingFrom ? t("ready.title.none") : trackingFrom > today ? t("ready.title.soon").replace("{day}", dmyDate(trackingFrom)) : t("ready.title.now");
  const OK = "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
  const WARN = "border-amber-500/35 bg-amber-500/10 text-amber-500";
  const NEUTRAL = "border-[var(--border-subtle)] text-[var(--text-dim)]";
  const chip = (cls: string, text: string) => <span className={`inline-flex h-6 items-center rounded-md border px-2 text-[11px] tabular-nums ${cls}`}>{text}</span>;
  /* Used in the last week counts as reachable in the Hub itself. */
  const recent = (ymd: string | null) => !!ymd && ymd >= addDays(today, -7);
  const started = !!trackingFrom && trackingFrom <= today;
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="kx-rep-ready">
      <h2 id="kx-rep-ready" className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-0.5 max-w-[80ch] text-[12px] leading-relaxed text-[var(--text-dim)]">{t("ready.hint")}</p>
      <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
        {rows.map((r) => (
          <li key={r.person.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar person={r.person} size={26} />
              <span className="truncate text-[12.5px] font-medium text-[var(--text-primary)]">{r.person.name}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {chip(recent(r.lastUsed) ? OK : WARN, r.lastUsed ? t("ready.used").replace("{date}", dmyDate(r.lastUsed)) : t("ready.usedNever"))}
              {chip(r.devices > 0 ? OK : WARN, r.devices > 0 ? t("ready.push.on").replace("{n}", String(r.devices)) : t("ready.push.off"))}
              {chip(r.firstSent ? OK : started ? WARN : NEUTRAL, r.firstSent ? t("ready.sent").replace("{date}", dmyDate(r.firstSent)) : t("ready.notYet"))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const KEYS: ObligationKey[] = ["daily", "weekly", "monthly"];

/** Who writes what: the owner's default per person, and the exceptions. */
function Setup({ t, lang, onChanged }: { t: T; lang: string; onChanged: () => void }) {
  const [data, setData] = useState<ObligationSetup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState(false);
  useEffect(() => { void Promise.resolve().then(async () => { const res = await fetchObligations(); if (res.ok) setData(res.data); else setProblem(true); }); }, []);

  const toggle = async (accountId: string, key: ObligationKey, defaults: Obliged, now: boolean) => {
    const next = !now;
    setBusy(`${accountId}:${key}`); setProblem(false);
    /* Back at the default → no exception at all. */
    const res = await saveObligations({ exceptions: [{ accountId, key, required: next === defaults[key] ? null : next }] });
    setBusy(null);
    if (res.ok) { setData(res.data); onChanged(); } else setProblem(true);
  };
  const saveStart = async (iso: string | null) => {
    setBusy("start"); setProblem(false);
    const res = await saveObligations({ trackingFrom: iso });
    setBusy(null);
    if (res.ok) { setData(res.data); onChanged(); } else setProblem(true);
  };
  const saveSwitch = async (key: "reminders" | "escalations", value: boolean) => {
    setBusy(key); setProblem(false);
    const res = await saveObligations({ [key]: value });
    setBusy(null);
    if (res.ok) setData(res.data); else setProblem(true);
  };
  const [preview, setPreview] = useState<NudgePreview | null>(null);
  const runPreview = async () => {
    setBusy("preview"); setProblem(false);
    const res = await previewNudges();
    setBusy(null);
    if (res.ok) setPreview(res.data); else setProblem(true);
  };
  const nameOf = new Map((data?.rows ?? []).map((r) => [r.person.id, r.person.name]));

  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="kx-rep-setup">
      <h2 id="kx-rep-setup" className="text-[14px] font-semibold text-[var(--text-primary)]">{t("compliance.setup")}</h2>
      <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">{t("compliance.setupHint")}</p>
      {problem && <p role="alert" className="mt-2 text-[12px] text-red-500">{t("err.generic")}</p>}
      {!data ? <div className="grid place-items-center py-8"><SpinnerIcon size={16} /></div> : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className="text-[var(--text-secondary)]">{t("compliance.startOn")}</span>
            <div className="w-[170px]"><DatePicker id="kx-rep-setup-from" value={data.trackingFrom ?? ""} onChange={(iso) => void saveStart(iso || null)} lang={lang} /></div>
            {busy === "start" && <SpinnerIcon size={12} />}
            {!data.trackingFrom && <span className="text-[11.5px] text-[var(--text-dim)]">{t("compliance.notStartedShort")}</span>}
          </div>

          {/* Phase 3B: the two nudges, each can be paused. */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(["reminders", "escalations"] as const).map((k) => (
              <div key={k} className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{t(`nudge.${k}`)}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-dim)]">{t(`nudge.${k}Hint`)}</p>
                </div>
                <button type="button" role="switch" aria-checked={data[k]} aria-label={t(`nudge.${k}`)} disabled={!!busy} onClick={() => void saveSwitch(k, !data[k])}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60 ${data[k] ? "bg-emerald-500" : "bg-[var(--bg-surface)] ring-1 ring-inset ring-[var(--border-subtle)]"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200 ${data[k] ? "start-[22px]" : "start-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-[var(--text-dim)]">{data.trackingFrom ? t("nudge.live") : t("nudge.notYet")}</p>
          <div className="mt-2">
            <button type="button" onClick={() => void runPreview()} disabled={!!busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60">
              {busy === "preview" ? <SpinnerIcon size={11} /> : <RrIcon name="eye" size={12} />}{t("nudge.preview")}
            </button>
            {preview && (
              <div className="mt-2 rounded-xl border border-[var(--border-subtle)] p-3 text-[12px]">
                {!preview.planned?.length ? <p className="text-[var(--text-dim)]">{t("nudge.previewNone")}</p> : (
                  <ul className="space-y-1">
                    {preview.planned.map((n, i) => (
                      <li key={i} className="text-[var(--text-secondary)]">
                        <span className={n.kind === "reminder" ? "text-sky-400" : "text-amber-500"}>{t(`nudge.kind.${n.kind}`)}</span>
                        {" · "}{n.authorName}{" · "}{t(`tpl.${n.key}.name`)} <span className="tabular-nums text-[var(--text-dim)]">({t("compliance.dueAt").replace("{at}", dmyTime(n.dueAt))})</span>
                        {n.kind === "escalation" && <> {"→ "}{n.recipients.map((r) => nameOf.get(r) ?? "—").join(", ")}</>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
            {data.rows.map((r) => (
              <li key={r.person.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar person={r.person} size={26} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium text-[var(--text-primary)]">{r.person.name}</span>
                    <span className="block truncate text-[10.5px] text-[var(--text-dim)]">
                      {r.isSuperAdmin ? t("compliance.exempt") : r.hasTeam ? t("compliance.manager") : r.person.position ?? ""}
                    </span>
                  </span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {KEYS.map((k) => {
                    const on = r.exceptions[k] ?? r.defaults[k];
                    const changed = r.exceptions[k] !== undefined;
                    return (
                      <button key={k} type="button" role="switch" aria-checked={on} disabled={!!busy} onClick={() => void toggle(r.person.id, k, r.defaults, on)}
                        title={changed ? t("compliance.changed") : t("compliance.default")}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors disabled:opacity-60 ${on
                          ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-500"
                          : "border-[var(--border-subtle)] text-[var(--text-dim)]"}`}>
                        {busy === `${r.person.id}:${k}` ? <SpinnerIcon size={11} /> : on ? <RrIcon name="check" size={10} /> : <RrIcon name="cross" size={9} />}
                        {t(`compliance.k.${k}`)}
                        {changed && <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden />}
                      </button>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
          <ScheduleSetup t={t} people={data.rows.map((r) => r.person)} />
        </>
      )}
    </section>
  );
}

/** A period key in words, day first: a month "09/2026", an ISO week its
 *  Monday to Sunday. */
function periodText(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (m) return `${m[2]}/${m[1]}`;
  /* 6D: a quarter or a half-year its first to last day; a year itself. */
  const qh = /^(\d{4})-([QH])([1-4])$/.exec(key);
  if (qh) {
    const span = qh[2] === "Q" ? 3 : 6;
    const p = periodFor(qh[2] === "Q" ? "quarterly" : "halfyear", `${qh[1]}-${String((Number(qh[3]) - 1) * span + 1).padStart(2, "0")}-01`);
    return `${dmyDate(p.start)} – ${dmyDate(p.end)}`;
  }
  if (/^\d{4}$/.test(key)) return key;
  const w = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!w) return key;
  const DAY = 86_400_000;
  const jan4 = Date.UTC(Number(w[1]), 0, 4);
  const monday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DAY + (Number(w[2]) - 1) * 7 * DAY;
  return `${dmyDate(new Date(monday).toISOString().slice(0, 10))} – ${dmyDate(new Date(monday + 6 * DAY).toISOString().slice(0, 10))}`;
}

/* ── 5D: the drafts the system prepares on schedule ──────────────────
   A person × a week's or a month's type: when that period ends, Koleex
   prepares its draft (07:00 in the person's own time) and tells them —
   nothing is sent by itself, and a schedule gives nobody a right. */
function ScheduleSetup({ t, people }: { t: T; people: ReportPerson[] }) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState(false);
  const [who, setWho] = useState("");
  const [what, setWhat] = useState("");
  useEffect(() => { void Promise.resolve().then(async () => { const res = await fetchSchedules(); if (res.ok) setData(res.data); else setProblem(true); }); }, []);
  const save = async (tag: string, body: Parameters<typeof saveSchedule>[0]): Promise<boolean> => {
    setBusy(tag); setProblem(false);
    const res = await saveSchedule(body);
    setBusy(null);
    if (res.ok) { setData(res.data); return true; }
    setProblem(true);
    return false;
  };
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const taken = new Set((data?.schedules ?? []).map((x) => `${x.accountId}|${x.templateKey}`));

  return (
    <div className="mt-6 border-t border-[var(--border-subtle)] pt-4" role="group" aria-labelledby="kx-rep-sched">
      <h3 id="kx-rep-sched" className="text-[13px] font-semibold text-[var(--text-primary)]">{t("compliance.sched.title")}</h3>
      <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-dim)]">{t("compliance.sched.hint")}</p>
      {problem && <p role="alert" className="mt-2 text-[12px] text-red-500">{t("err.generic")}</p>}
      {!data ? <div className="grid place-items-center py-6"><SpinnerIcon size={14} /></div> : (
        <>
          {data.schedules.length === 0 ? <p className="mt-3 text-[12px] text-[var(--text-dim)]">{t("compliance.sched.none")}</p> : (
            <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
              {data.schedules.map((x) => {
                const tag = `${x.accountId}|${x.templateKey}`;
                const cadence = reportHead(x.templateKey)?.cadence;
                const when = isScheduleCadence(cadence) ? t(`compliance.sched.${cadence}`) : "";
                /* Only a draft that was really prepared — a new schedule's
                   starting period is not one. */
                const last = x.lastPeriod && x.lastReportId ? t("compliance.sched.last").replace("{period}", periodText(x.lastPeriod)) : "";
                return (
                  <li key={tag} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-[var(--text-primary)]">{nameOf.get(x.accountId) ?? "—"} · {t(`tpl.${x.templateKey}.name`, x.templateKey)}</span>
                      <span className="block truncate text-[11px] text-[var(--text-dim)]">
                        {[when, last].filter(Boolean).join(" · ")}
                        {x.lastReportId && <> · <Link href={`/reports/${x.lastReportId}`} className="underline">{t("compliance.open")}</Link></>}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <button type="button" role="switch" aria-checked={x.active} aria-label={t(`tpl.${x.templateKey}.name`, x.templateKey)} disabled={!!busy}
                        onClick={() => void save(tag, { accountId: x.accountId, templateKey: x.templateKey, active: !x.active })}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60 ${x.active ? "bg-emerald-500" : "bg-[var(--bg-surface)] ring-1 ring-inset ring-[var(--border-subtle)]"}`}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200 ${x.active ? "start-[22px]" : "start-0.5"}`} />
                      </button>
                      <button type="button" disabled={!!busy} onClick={() => void save(`rm:${tag}`, { accountId: x.accountId, templateKey: x.templateKey, remove: true })}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[11.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60">
                        {busy === `rm:${tag}` ? <SpinnerIcon size={11} /> : <RrIcon name="trash" size={11} />}{t("compliance.sched.remove")}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[160px] flex-1">
              <span className="mb-1 block text-[11px] text-[var(--text-dim)]">{t("compliance.sched.person")}</span>
              <select value={who} onChange={(e) => setWho(e.target.value)} className={FIELD}>
                <option value="">—</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="min-w-[200px] flex-[2]">
              <span className="mb-1 block text-[11px] text-[var(--text-dim)]">{t("compliance.sched.type")}</span>
              <select value={what} onChange={(e) => setWhat(e.target.value)} className={FIELD}>
                <option value="">—</option>
                {data.types.map((k) => <option key={k} value={k} disabled={!!who && taken.has(`${who}|${k}`)}>{t(`tpl.${k}.name`, k)}</option>)}
              </select>
            </label>
            <button type="button" disabled={!who || !what || !!busy || taken.has(`${who}|${what}`)}
              onClick={() => void save("add", { accountId: who, templateKey: what, active: true }).then((ok) => { if (ok) setWhat(""); })}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 text-[12px] font-semibold text-[var(--text-inverted)] disabled:opacity-50">
              {busy === "add" ? <SpinnerIcon size={11} /> : <RrIcon name="plus" size={11} />}{t("compliance.sched.add")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
