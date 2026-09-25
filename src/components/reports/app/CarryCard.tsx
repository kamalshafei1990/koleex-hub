"use client";

/* ---------------------------------------------------------------------------
   The composer's "From your earlier reports" card (Reports Phase 2A).

   Every suggestion waits for a tap. One place it can go → a chip that adds
   it there. Two places (done, or still pending? reached, or on to next
   week?) → the two section names as equal buttons, the Approve / Return
   lesson. "All to …" fills the likeliest place in one go. Whether an item is
   already in the report is read from the text itself (isPlaced), so the card
   is right after a reload and offers a line again if the author deletes it.

   It arrives with the report (no second request), so it never pushes the
   sections down after first paint — only the author's own taps change it.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import RrIcon from "@/components/ui/RrIcon";
import { insertInto, isPlaced, type CarryGroup, type CarryItem } from "@/lib/reports/carry";
import { reportTemplate, type ReportTemplateDef } from "@/lib/reports/templates";
import { dmyDate, periodLabel } from "@/lib/work-reports";
import { CARD, tplName, type T } from "./shared";
import ClampedText from "./ClampedText";

/** Shown before "Show all": chips are small, rows are not. */
const FIRST_CHIPS = 8;
const FIRST_ROWS = 4;
const SMALL_BTN =
  "inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-[11.5px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-focus)] hover:text-[var(--text-primary)]";

const dayMonth = (ymd: string | null) => (ymd ? dmyDate(ymd).slice(0, 5) : "");

export default function CarryCard({ t, tpl, groups, texts, onPlace }: {
  t: T;
  tpl: ReportTemplateDef;
  groups: CarryGroup[];
  texts: Record<string, string>;
  onPlace: (sectionId: string, value: string) => void;
}) {
  const waitingAll = groups.reduce((n, g) => n + g.items.filter((i) => !isPlaced(i, texts, g.to)).length, 0);
  /* Open while something waits; after that, the author's own toggle. */
  const [open, setOpen] = useState(() => waitingAll > 0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [note, setNote] = useState<string | null>(null);
  if (!groups.length) return null;

  const kindOf = (sid: string) => tpl.sections.find((s) => s.id === sid)?.kind ?? "text";
  const target = (sid: string) => t(`tpl.${tpl.key}.s.${sid}`);
  const noRoom = (sid: string) => setNote(t("carry.full").replace("{section}", target(sid)));
  const expand = (key: string) => setExpanded((s) => new Set(s).add(key));

  const placeOne = (item: CarryItem, sid: string) => {
    const next = insertInto(texts[sid] ?? "", item, kindOf(sid));
    if (next === null) { noRoom(sid); return; }
    setNote(null);
    onPlace(sid, next);
  };
  /* Everything still waiting, into the likeliest place, as ONE change. */
  const placeAll = (g: CarryGroup) => {
    const sid = g.to[0];
    const before = texts[sid] ?? "";
    let body = before;
    let stopped = false;
    for (const item of g.items) {
      if (isPlaced(item, { ...texts, [sid]: body }, g.to)) continue;
      const next = insertInto(body, item, kindOf(sid));
      if (next === null) { stopped = true; break; }
      body = next;
    }
    if (body !== before) onPlace(sid, body);
    if (stopped) noRoom(sid); else setNote(null);
  };

  return (
    <section className={`${CARD} p-4`} aria-labelledby="kx-carry-title">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#567FB2]/12 text-[#9DBCE0]"><RrIcon name="clock" size={14} /></span>
        <div className="min-w-0 flex-1">
          <h2 id="kx-carry-title" className="text-[13px] font-semibold text-[var(--text-primary)]">{t("carry.title")}</h2>
          <p className="text-[11.5px] text-[var(--text-dim)]">
            {open ? t("carry.hint") : waitingAll ? t("carry.waiting").replace("{n}", String(waitingAll)) : t("carry.allAdded")}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="kx-carry-body" className={SMALL_BTN}>
          {open ? t("carry.hide") : t("carry.show")}
        </button>
      </div>

      {open && (
        <div id="kx-carry-body" className="mt-4 space-y-4">
          {groups.map((g) => {
            const key = `${g.from}.${g.section}`;
            const many = g.sources.length > 1;
            const chips = g.to.length === 1 && !g.items.some((i) => i.paragraph);
            const cap = chips ? FIRST_CHIPS : FIRST_ROWS;
            const shown = expanded.has(key) ? g.items : g.items.slice(0, cap);
            const waiting = g.items.filter((i) => !isPlaced(i, texts, g.to)).length;
            const first = g.sources[0];
            const last = g.sources[g.sources.length - 1];
            const when = many
              ? `${periodLabel(first.start, last.end)} (${g.sources.length})`
              : reportTemplate(g.from)?.cadence === "daily" ? dmyDate(first.start) : periodLabel(first.start, first.end);
            return (
              <div key={key}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <p className="min-w-0 text-[12px] font-semibold text-[var(--text-secondary)]">
                    {t(`tpl.${g.from}.s.${g.section}`)}
                    <span className="ms-1.5 font-normal text-[var(--text-faint)] tabular-nums">· {tplName(t, g.from)} · {when}</span>
                  </p>
                  {waiting >= 2 && (
                    <button type="button" onClick={() => placeAll(g)} className={SMALL_BTN}>
                      <RrIcon name="plus" size={9} />{t("carry.addAllTo").replace("{section}", target(g.to[0]))}
                    </button>
                  )}
                </div>

                {chips ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {shown.map((item, i) => {
                      const placed = isPlaced(item, texts, g.to);
                      return (
                        <li key={i} className="min-w-0 max-w-full">
                          <button type="button" disabled={placed} onClick={() => placeOne(item, g.to[0])} title={item.text}
                            aria-label={placed ? `${item.text} · ${t("carry.added")}` : `${item.text} → ${target(g.to[0])}`}
                            className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-start text-[12px] transition-colors ${placed
                              ? "border-transparent text-[var(--text-faint)]"
                              : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] hover:border-[var(--border-focus)]"}`}>
                            <span className={`shrink-0 ${placed ? "text-emerald-500" : "text-[var(--text-dim)]"}`}><RrIcon name={placed ? "check" : "plus"} size={10} /></span>
                            <span className="truncate">{item.text}</span>
                            {many && item.date && <span className="shrink-0 text-[10.5px] text-[var(--text-faint)] tabular-nums">{dayMonth(item.date)}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <ul className="space-y-1.5">
                    {shown.map((item, i) => {
                      const placed = isPlaced(item, texts, g.to);
                      return (
                        <li key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
                          <ItemText text={item.text} paragraph={item.paragraph} placed={placed} tag={many ? dayMonth(item.date) : ""} t={t} />
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {placed ? (
                              /* The buttons' height, so the row does not jump when they go. */
                              <span className="inline-flex h-7 items-center gap-1 text-[11.5px] text-emerald-500"><RrIcon name="check" size={10} />{t("carry.added")}</span>
                            ) : g.to.map((sid) => (
                              <button key={sid} type="button" onClick={() => placeOne(item, sid)} className={SMALL_BTN}
                                aria-label={`${item.text.slice(0, 80)} → ${target(sid)}`}>
                                <RrIcon name="plus" size={9} />{target(sid)}
                              </button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {g.items.length > cap && !expanded.has(key) && (
                  <button type="button" onClick={() => expand(key)} className="mt-2 text-[11.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                    {t("carry.showAll").replace("{n}", String(g.items.length))}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {note && <p role="status" className="mt-3 text-[12px] text-amber-500">{note}</p>}
    </section>
  );
}

/** One suggestion's words. A whole paragraph (a week's summary) shows four
 *  lines and opens in place, so it can be read before it is added. */
function ItemText({ text, paragraph, placed, tag, t }: { text: string; paragraph: boolean; placed: boolean; tag: string; t: T }) {
  const tone = placed ? "text-[var(--text-faint)]" : "text-[var(--text-primary)]";
  const words = (
    <>
      {text}
      {tag && <span className="ms-2 text-[10.5px] text-[var(--text-faint)] tabular-nums">{tag}</span>}
    </>
  );
  return (
    <div className={`text-[12.5px] leading-relaxed ${tone}`}>
      {paragraph
        ? <ClampedText className="whitespace-pre-wrap break-words" more={t("carry.more")} less={t("carry.less")}>{words}</ClampedText>
        : <p className="break-words">{words}</p>}
    </div>
  );
}
