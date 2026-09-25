"use client";

/* ---------------------------------------------------------------------------
   Reports → Compliance (Phase 3A): who was expected to send which report
   this week, and what happened — on the person's OWN calendar (their
   country's weekend and holidays, their leave, their end of day).

   One request per week shown (/api/work-reports/compliance). A super admin
   and HR see everyone; a manager their own people. Cells say whether a
   report was sent, never its text; a sent one links to it unless it was
   confidential. Until tracking starts nobody is marked late or missing —
   the setup (super admin / HR·edit) picks the day, and who writes what.
   Loaded only when the tab opens (next/dynamic in ReportsApp).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import RrIcon from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DatePicker from "@/components/ui/DatePicker";
import { addDays } from "@/lib/reports/obligations";
import type { Cell, CellState, ObligationKey, Obliged } from "@/lib/reports/obligations";
import { dmyDate, dmyTime, fetchCompliance, fetchObligations, localToday, previewNudges, saveObligations, type ComplianceBoard, type NudgePreview, type ObligationSetup } from "@/lib/work-reports";
import { Avatar, CARD, type T } from "./shared";

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

export default function ComplianceTab({ t, lang }: { t: T; lang: string }) {
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
          <TrackingBanner t={t} canSetUp={board.canSetUp} onStarted={() => void load(day)} />
        )}
      </section>

      {/* Keyed on the start date, so a start set from the banner shows here too. */}
      {setupOpen && board?.canSetUp && <Setup key={board.trackingFrom ?? "none"} t={t} onChanged={() => void load(day)} />}

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

function TrackingBanner({ t, canSetUp, onStarted }: { t: T; canSetUp: boolean; onStarted: () => void }) {
  const [date, setDate] = useState(() => localToday());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const start = async () => {
    setBusy(true); setProblem(false);
    const res = await saveObligations({ trackingFrom: date });
    setBusy(false);
    if (res.ok) onStarted(); else setProblem(true);
  };
  return (
    <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-[12.5px] text-[var(--text-secondary)]">
      <p>{t("compliance.notStarted")}</p>
      {canSetUp && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-[var(--text-dim)]">{t("compliance.startOn")}</span>
          <div className="w-[170px]"><DatePicker id="kx-rep-track-from" value={date} onChange={(iso) => { if (iso) setDate(iso); }} /></div>
          <button type="button" onClick={() => void start()} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--bg-inverted)] px-3 text-[12.5px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">
            {busy && <SpinnerIcon size={12} />}{t("compliance.start")}
          </button>
          {problem && <span role="alert" className="text-[12px] text-red-500">{t("err.generic")}</span>}
        </div>
      )}
    </div>
  );
}

const KEYS: ObligationKey[] = ["daily", "weekly", "monthly"];

/** Who writes what: the owner's default per person, and the exceptions. */
function Setup({ t, onChanged }: { t: T; onChanged: () => void }) {
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
            <div className="w-[170px]"><DatePicker id="kx-rep-setup-from" value={data.trackingFrom ?? ""} onChange={(iso) => void saveStart(iso || null)} /></div>
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
        </>
      )}
    </section>
  );
}
