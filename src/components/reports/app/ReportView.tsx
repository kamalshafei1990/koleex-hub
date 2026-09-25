"use client";

/* ---------------------------------------------------------------------------
   /reports/[id] — one report. A draft opens for its author as the composer;
   anything sent opens as the reader.

   Composer: the template's sections (text, or one item per line, or a
   Phase 4A block — checklist, score, table, links, signature, from
   ReportBlocks), the period, To / Copy (filled from the type's default
   readers), Confidential,
   and — for the daily / weekly / monthly family — the author's earlier
   reports offered as tap-to-add suggestions (CarryCard; nothing is added
   by itself). Photos and files (AttachmentsEditor): made smaller on the
   phone, uploaded one at a time; Send waits until they are all in.
   It saves itself a moment after each change — one save on the wire at a
   time, always of the latest text — and once more when the page closes,
   so nothing typed is lost. Send saves first. The server enforces the same
   rules (required sections, a title where the type has one, one "To").

   Reader: every section in the reader's own language (AutoTranslatedText —
   a report written in Chinese reads in Arabic, with the original one click
   away), who it went to and who read it, the review / acknowledge actions
   the server allows THIS viewer, the photos and files (AttachmentsView),
   and the thread.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation, type Translations } from "@/lib/i18n";
import { reportsT } from "@/lib/translations/reports";
import { loadReportWords } from "@/lib/translations/report-sections";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import DatePicker from "@/components/ui/DatePicker";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import RrIcon from "@/components/ui/RrIcon";
import { BACK_CHROME } from "@/components/ui/back-chrome";
import {
  REPORT_LIMITS, blockFileIds, missingSections, periodFor, rangeEnd, type ReportDataValue, type ReportSectionKind, type ReportSectionValue, type ReportTemplateDef,
} from "@/lib/reports/templates";
import { carryRulesFor, type CarryGroup } from "@/lib/reports/carry";
import { appRulesFor, buildFeedGroups, type AppRecord } from "@/lib/reports/app-feed";
import { serverMaterial, toSection, writeMaterial, writingLang, type WritingLang } from "@/lib/reports/ai-draft";
import {
  commentOnReport, decideReport, deleteDraft, dmyDate, dmyTime, fetchCarry, fetchReport, periodLabel, reviseReport, saveDraft, submitReport,
  type ReportDetail, type ReportPerson, type ReportRecipient,
} from "@/lib/work-reports";
import { Avatar, Badge, CARD, FIELD, StatusChip, TemplateIcon, tplName, type T } from "./shared";
import CarryCard from "./CarryCard";
import AttachmentsEditor from "./AttachmentsEditor";
import AttachmentsView from "./AttachmentsView";
import { DictStatus, SectionAiButtons, SectionAiProposal, SectionMic, useSectionAi } from "./SectionAi";
import { dictationSupported, useDictation } from "@/components/ai/useDictation";

/* The Phase 4A blocks' code (ReportBlocks) is its own chunk: only a report
   whose template has a block fetches it, and that report opens once the
   chunk is here — the page lays out once, never twice. The template's own
   words (sections, points, answers, columns — Phase 4C) come the same way:
   one chunk per family, asked for with the report. */
type BlocksModule = typeof import("./ReportBlocks");
const isBlock = (kind: ReportSectionKind) => kind !== "text" && kind !== "list";
const hasBlocks = (tpl: ReportTemplateDef | null) => !!tpl?.sections.some((x) => isBlock(x.kind));
/** The report's own type — it comes WITH the report (a built-in's
 *  definition, or a builder type as the report was started with it), so
 *  this page never carries the catalog of every type (5C). */
const typeOf = (d: ReportDetail): ReportTemplateDef | null => d.template?.def ?? null;

export default function ReportView({ id }: { id: string }) {
  const [sectionWords, setSectionWords] = useState<Translations | null>(null);
  const words = useMemo(() => (sectionWords ? { ...reportsT, ...sectionWords } : reportsT), [sectionWords]);
  const { t, lang } = useTranslation(words);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [blocks, setBlocks] = useState<BlocksModule | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "missing" | "error">("loading");

  const load = useCallback(async () => {
    const res = await fetchReport(id);
    if (res.ok) {
      try {
        /* A built-in type's one-line description (5B) shows only in a
           draft's header — its own chunk, asked for with the words; the
           blocks' own words come with the blocks' code. */
        const [mod, own, descs] = await Promise.all([
          hasBlocks(typeOf(res.data)) ? import("./ReportBlocks") : Promise.resolve(null),
          loadReportWords(res.data.wordFamilies ?? [], res.data.template?.words ? { words: res.data.template.words } : undefined),
          res.data.can.edit ? import("@/lib/translations/report-descs") : Promise.resolve(null),
        ]);
        if (mod) setBlocks(() => mod);
        setSectionWords({ ...(mod?.BLOCK_WORDS ?? {}), ...(descs?.reportDescsT ?? {}), ...own });
      } catch { setPhase("error"); return; }
      setDetail(res.data); setPhase("ready");
    }
    else setPhase(res.status === 404 ? "missing" : "error");
  }, [id]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-full">
      {/* The Hub shell — the same width and top padding as every app (the
          owner's fit-the-screen rule). It was 1100 wide with pt-12: pt-12
          cleared a frosted ramp that once hung 3rem below the header, but the
          header is solid at rest now and nothing paints in that strip
          (measured 25/09), so the padding had become a gap. !pb-28 keeps this
          page's own bottom clearance — the compact density layer rewrites
          .py-6's bottom to 16px otherwise. */}
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-28">
        {/* The Hub's back control, not a text link — the same chip as every
            app's "← Hub", in a row above the card as Product Data's record
            view has it. The arrow keeps its RTL flip; RrIcon does not mirror. */}
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <Link href="/reports" aria-label={t("reader.back")} className={BACK_CHROME}>
            <span className="inline-block rtl:rotate-180"><RrIcon name="arrow-left" size={14} /></span>
            <span className="hidden text-[12px] font-medium sm:inline">{t("app.title")}</span>
          </Link>
        </div>
        {phase === "loading" && <div className={`${CARD} grid place-items-center py-20`}><SpinnerIcon size={20} /></div>}
        {phase === "missing" && <div className={`${CARD} px-6 py-14 text-center text-[13px] text-[var(--text-dim)]`}>{t("reader.notFound")}</div>}
        {phase === "error" && (
          <div className={`${CARD} px-6 py-14 text-center text-[13px] text-[var(--text-dim)]`}>
            {t("err.generic")} <button type="button" className="ms-2 underline" onClick={() => void load()}>↻</button>
          </div>
        )}
        {phase === "ready" && detail && (detail.can.edit
          ? <Composer t={t} lang={lang} detail={detail} blocks={blocks} onSent={load} />
          : <Reader t={t} lang={lang} detail={detail} blocks={blocks} onChange={load} />)}
      </div>
    </div>
  );
}

/* ── Composer ──────────────────────────────────────────────────────────── */

/** A textarea that grows with what is written (up to 70 % of the screen,
 *  then it scrolls), so a long report is read whole while it is written. */
function GrowingTextarea({ value, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, Math.round(window.innerHeight * 0.7))}px`;
  }, [value]);
  return <textarea ref={ref} value={value} {...rest} />;
}

type Draft = { title: string; date: string; dateTo: string; texts: Record<string, string>; blocks: Record<string, ReportSectionValue>; to: string[]; cc: string[]; confidential: boolean };

function toDraft(d: ReportDetail): Draft {
  const texts: Record<string, string> = {};
  const blocks: Record<string, ReportSectionValue> = {};
  const kinds = new Map((typeOf(d)?.sections ?? []).map((x) => [x.id, x.kind]));
  for (const s of d.report.sections) {
    const kind = kinds.get(s.id);
    if (kind && isBlock(kind)) blocks[s.id] = s;
    else texts[s.id] = s.items ? s.items.join("\n") : (s.text ?? "");
  }
  return {
    title: d.report.title,
    date: d.report.periodStart ?? "",
    /* A trip or a visit (4D) spans its own days; any other report, one period. */
    dateTo: d.report.periodEnd ?? d.report.periodStart ?? "",
    texts,
    blocks,
    to: d.recipients.filter((r) => r.role === "to").map((r) => r.id),
    cc: d.recipients.filter((r) => r.role === "cc").map((r) => r.id),
    confidential: d.report.confidential,
  };
}

function sectionsOf(tpl: ReportTemplateDef, texts: Record<string, string>, blocks: Record<string, ReportSectionValue>): ReportSectionValue[] {
  return tpl.sections.map((s) => isBlock(s.kind)
    ? { ...(blocks[s.id] ?? {}), id: s.id }
    : s.kind === "list"
      ? { id: s.id, items: (texts[s.id] ?? "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, REPORT_LIMITS.items) }
      : { id: s.id, text: (texts[s.id] ?? "").slice(0, REPORT_LIMITS.text) });
}

function Composer({ t, lang, detail, blocks, onSent }: { t: T; lang: string; detail: ReportDetail; blocks: BlocksModule | null; onSent: () => Promise<void> }) {
  const router = useRouter();
  const tpl = typeOf(detail);
  const id = detail.report.id;
  const [draft, setDraft] = useState<Draft>(() => toDraft(detail));
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "error"; at?: string }>({ state: "idle" });
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /* A photo or file still on its way — in the attachments or in a block
     (a checklist photo, a signature): Send waits for it. */
  const [attBusy, setAttBusy] = useState(false);
  const [blockBusy, setBlockBusy] = useState(0);
  const uploading = attBusy || blockBusy > 0;
  const bumpBusy = useCallback((busy: boolean) => setBlockBusy((n) => Math.max(0, n + (busy ? 1 : -1))), []);
  /* Koleex AI's proposals, per section (fill, never save). */
  const ai = useSectionAi(detail.report.id, t);
  /* Dictation: one section listens at a time; its words land at the end of
     that section when the author stops. The spoken language is its own
     choice (kept on this device), Arabic heard as Egyptian Arabic. */
  const uiLang = (["en", "zh", "ar"] as const).find((l) => l === lang) ?? "en";
  const [canDictate] = useState(() => typeof window !== "undefined" && dictationSupported());
  const [dictLang, setDictLang] = useState<WritingLang>(() => {
    try { const v = window.localStorage.getItem("kx-report-dict-lang"); if (v === "en" || v === "zh" || v === "ar") return v; } catch { /* storage blocked */ }
    return writingLang(detail.report.sections.map((x) => x.text ?? (x.items ?? []).join(" ")), uiLang);
  });
  const dictFor = useRef<string | null>(null);
  const [dictSection, setDictSection] = useState<string | null>(null);
  const [dictProblem, setDictProblem] = useState<{ sid: string; msg: string } | null>(null);
  const dictation = useDictation({
    lang: uiLang,
    locale: dictLang === "ar" ? "ar-EG" : dictLang === "zh" ? "zh-CN" : "en-US",
    onTranscript: (spoken) => {
      const sid = dictFor.current;
      const kind = sid ? typeOf(detail)?.sections.find((x) => x.id === sid)?.kind : null;
      if (!sid || !kind) return;
      const current = (draftRef.current.texts[sid] ?? "").replace(/\s+$/, "");
      change({ texts: { ...draftRef.current.texts, [sid]: !current ? spoken : kind === "list" ? `${current}\n${spoken}` : `${current} ${spoken}` } });
    },
    onError: (msg) => { if (dictFor.current) setDictProblem({ sid: dictFor.current, msg }); },
  });
  const draftRef = useRef(draft);
  const dirty = useRef(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const people = useMemo(() => detail.people ?? [], [detail.people]);
  const nameOf = useMemo(() => new Map([...people, ...detail.recipients].map((p) => [p.id, p])), [people, detail.recipients]);
  /* The suggestions arrive with the report; moving the draft to another
     day / week / month asks again for that period (the latest answer wins).
     `key` remounts the card for a new period, so it reopens fresh. The
     numbers blocks (4B) ride the same answers: computed by the server for
     the period now shown. */
  const [carry, setCarry] = useState<{ key: string; groups: CarryGroup[]; feed: AppRecord[]; data: Record<string, ReportDataValue> }>(() => ({
    key: detail.report.periodKey ?? "", groups: detail.carry ?? [], feed: detail.appFeed ?? [], data: detail.blockData ?? {},
  }));
  const carryAsk = useRef(0);
  const moveCarry = useCallback((date: string, key: string, to?: string) => {
    const n = ++carryAsk.current;
    void fetchCarry(id, date, to).then((res) => {
      if (res.ok && n === carryAsk.current) setCarry({ key, groups: res.data.carry, feed: res.data.appFeed ?? [], data: res.data.blockData ?? {} });
    });
  }, [id]);
  /* The apps' facts, on the author's own clock and in their language (`t`
     changes with the language, so the words follow a switch). */
  const feedGroups = useMemo(() => {
    if (!tpl || !draft.date || !carry.feed.length) return [];
    const tz = -new Date().getTimezoneOffset();
    const time = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
    return buildFeedGroups(tpl, periodFor(tpl.cadence, draft.date), carry.feed, { t, time, day: (ymd) => dmyDate(ymd).slice(0, 5), tzOffsetMin: tz });
  }, [tpl, draft.date, carry.feed, t]);

  const patchOf = useCallback((d: Draft) => (tpl ? {
    title: tpl.customTitle ? d.title : undefined, date: d.date || undefined, dateTo: tpl.range ? d.dateTo || undefined : undefined,
    sections: sectionsOf(tpl, d.texts, d.blocks), to: d.to, cc: d.cc, confidential: d.confidential,
  } : null), [tpl]);

  /* One save on the wire at a time, always of the LATEST draft — a slow save
     can never land after a newer one and put old text back. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    while (inFlight.current) await inFlight.current;
    if (!dirty.current) return true;
    const patch = patchOf(draftRef.current);
    if (!patch) return false;
    dirty.current = false;
    setSave({ state: "saving" });
    const run = saveDraft(id, patch).then((res) => {
      if (res.ok) { setSave({ state: "saved", at: res.data.savedAt }); return true; }
      dirty.current = true;
      setSave({ state: "error" });
      return false;
    });
    inFlight.current = run;
    try { return await run; } finally { inFlight.current = null; }
  }, [id, patchOf]);

  const change = useCallback((next: Partial<Draft>) => {
    const d = { ...draftRef.current, ...next };
    draftRef.current = d;
    dirty.current = true;
    setDraft(d);
    setProblem(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void flush(); }, 1200);
  }, [flush]);
  const setText = (sid: string, value: string) => change({ texts: { ...draftRef.current.texts, [sid]: value } });
  const setBlock = (sid: string, value: ReportSectionValue) => change({ blocks: { ...draftRef.current.blocks, [sid]: value } });
  /* The photos a block shows in place are not listed again under Photos. */
  const blockFiles = useMemo(() => blockFileIds(Object.values(draft.blocks)), [draft.blocks]);

  /* Closing the tab, or leaving for another page: the last change still lands. */
  useEffect(() => {
    const pending = timer;
    const onHide = () => {
      if (!dirty.current) return;
      const patch = patchOf(draftRef.current);
      if (!patch) return;
      dirty.current = false;
      void saveDraft(id, patch, { keepalive: true });
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (pending.current) clearTimeout(pending.current);
      onHide();
    };
  }, [id, patchOf]);

  if (!tpl) return <div className={`${CARD} px-6 py-10 text-center text-[13px] text-[var(--text-dim)]`}>{t("err.generic")}</div>;

  const period = draft.date ? periodFor(tpl.cadence, draft.date) : null;
  const sectionName = (sid: string) => t(`tpl.${tpl.key}.s.${sid}`);
  const screenLang = (["en", "zh", "ar"] as const).find((l) => l === lang) ?? "en";
  const kindOf = (sid: string) => tpl.sections.find((x) => x.id === sid)?.kind ?? "text";

  /* Koleex AI answers in the language the author WRITES in. */
  const tidy = (sid: string) => {
    const text = draftRef.current.texts[sid] ?? "";
    void ai.run({ action: "tidy", section: sid, lang: writingLang([text], screenLang as WritingLang), text });
  };
  const write = (sid: string) => {
    const d = draftRef.current;
    /* A team summary (5A): the server reads what the team sent — the page
       sends none of it back. */
    if (serverMaterial(tpl)) { void ai.run({ action: "write", section: sid, lang: writingLang(Object.values(d.texts), screenLang as WritingLang) }); return; }
    const heading = (g: CarryGroup) => (g.app ? t(`feed.g.${g.section}`) : `${t(`tpl.${g.from}.s.${g.section}`)} (${tplName(t, g.from)})`);
    const material = writeMaterial(
      [...carry.groups, ...feedGroups].map((g) => ({ heading: heading(g), group: g })),
      tpl.sections.filter((x) => x.id !== sid && !isBlock(x.kind)).map((x) => ({ name: sectionName(x.id), text: d.texts[x.id] ?? "" })),
    );
    const own = [...Object.values(d.texts), ...carry.groups.flatMap((g) => g.items.map((i) => i.text))];
    void ai.run({ action: "write", section: sid, lang: writingLang(own, screenLang as WritingLang), material });
  };
  const toggleDictation = (sid: string) => {
    setDictProblem(null);
    if (dictation.listening) { dictation.stop(); return; }
    dictFor.current = sid;
    setDictSection(sid);
    dictation.start();
  };
  const cycleDictLang = () => setDictLang((l) => {
    const next: WritingLang = l === "en" ? "ar" : l === "ar" ? "zh" : "en";
    try { window.localStorage.setItem("kx-report-dict-lang", next); } catch { /* storage blocked */ }
    return next;
  });
  const applyAi = (sid: string, mode: "replace" | "append") => {
    const answer = toSection(ai.slots[sid]?.text ?? "", kindOf(sid));
    const current = (draftRef.current.texts[sid] ?? "").replace(/\s+$/, "");
    setText(sid, mode === "append" && current ? `${current}${kindOf(sid) === "list" ? "\n" : "\n\n"}${answer}` : answer);
    ai.clear(sid);
  };

  const send = async () => {
    const d = draftRef.current;
    const missing = missingSections(tpl, sectionsOf(tpl, d.texts, d.blocks)).map(sectionName);
    if (tpl.customTitle && !d.title.trim()) missing.unshift(t("composer.titleLabel"));
    if (missing.length) { setProblem(`${t("composer.missing")} ${missing.join(" · ")}`); return; }
    if (d.to.length === 0) { setProblem(t("composer.noRecipients")); return; }
    if (uploading) { setProblem(t("attach.waitUpload")); return; }
    setSending(true);
    if (!(await flush())) { setSending(false); setProblem(t("err.saveFailed")); return; }
    const res = await submitReport(id);
    if (res.ok) { await onSent(); return; }
    setSending(false);
    if (res.error === "missing_sections") {
      const ids = (res.extra?.missing as string[] | undefined) ?? [];
      setProblem(`${t("composer.missing")} ${ids.map(sectionName).join(" · ")}`);
    } else if (res.error === "missing_title") setProblem(`${t("composer.missing")} ${t("composer.titleLabel")}`);
    else if (res.error === "no_recipients") setProblem(t("composer.noRecipients"));
    else setProblem(t("err.generic"));
  };

  const remove = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    while (inFlight.current) await inFlight.current;
    dirty.current = false;
    const res = await deleteDraft(id);
    if (res.ok) router.replace("/reports?tab=mine");
    else setProblem(t("err.generic"));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-3">
        <header className={`${CARD} flex flex-wrap items-center gap-3 p-4`}>
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#567FB2]/12 text-[#9DBCE0]"><TemplateIcon icon={tpl.icon} size={16} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] font-semibold text-[var(--text-primary)]">{tplName(t, tpl.key)}</h1>
            <p className="text-[12px] text-[var(--text-dim)]">{t(`tpl.${tpl.key}.desc`)}</p>
          </div>
          <StatusChip status="draft" t={t} />
          {detail.report.version > 1 && <Badge tone="accent">{t("badge.version")} {detail.report.version}</Badge>}
        </header>
        {detail.report.version > 1 && <p className="rounded-xl border border-[#567FB2]/30 bg-[#567FB2]/10 px-4 py-2.5 text-[12.5px] text-[var(--text-secondary)]">{t("composer.newVersionNote")}</p>}

        {carry.groups.length > 0 && <CarryCard key={carry.key} t={t} tpl={tpl} groups={carry.groups} texts={draft.texts} onPlace={setText} />}
        {feedGroups.length > 0 && <CarryCard key={`apps-${carry.key}`} variant="apps" t={t} tpl={tpl} groups={feedGroups} texts={draft.texts} onPlace={setText} />}

        {tpl.customTitle && (
          <label className={`${CARD} block p-4`}>
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--text-secondary)]">{t("composer.titleLabel")} <span className="font-normal text-[var(--text-faint)]">· {t("composer.required")}</span></span>
            <input id="kx-rep-title" value={draft.title} maxLength={REPORT_LIMITS.title} onChange={(e) => change({ title: e.target.value })} className={FIELD} />
          </label>
        )}

        {tpl.sections.map((s) => isBlock(s.kind) ? (
          <div key={s.id} className={`${CARD} block p-4`}>
            <p className="mb-2 flex flex-wrap items-baseline gap-x-2 text-[12px] font-semibold text-[var(--text-secondary)]">
              {sectionName(s.id)}
              {s.required && <span className="font-normal text-[var(--text-faint)]">· {t("composer.required")}</span>}
            </p>
            {blocks && <blocks.BlockEditor t={t} lang={lang} tplKey={tpl.key} def={s} value={draft.blocks[s.id] ?? { id: s.id }} reportId={id}
              version={detail.report.version} onChange={(v) => setBlock(s.id, v)} onBusy={bumpBusy} live={carry.data[s.id]} />}
          </div>
        ) : (
          /* A card, not a <label>: its head carries buttons now, and a label
             may hold only the one control it names. */
          <div key={s.id} className={`${CARD} block p-4`}>
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <label htmlFor={`kx-rep-${s.id}`} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12px] font-semibold text-[var(--text-secondary)]">
                {sectionName(s.id)}
                {s.required && <span className="font-normal text-[var(--text-faint)]">· {t("composer.required")}</span>}
                {s.kind === "list" && <span className="font-normal text-[var(--text-faint)]">· {t("composer.listHint")}</span>}
              </label>
              <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {canDictate && (
                  <SectionMic t={t} dictLang={dictLang} active={dictation.listening && dictSection === s.id}
                    busyElsewhere={dictation.listening && dictSection !== s.id}
                    onToggle={() => toggleDictation(s.id)} onCycleLang={cycleDictLang} />
                )}
                <SectionAiButtons t={t} template={tpl} sectionId={s.id} text={draft.texts[s.id] ?? ""} slot={ai.slots[s.id]}
                  onTidy={() => tidy(s.id)} onWrite={() => write(s.id)} />
              </span>
            </div>
            <GrowingTextarea
              id={`kx-rep-${s.id}`}
              /* The author's words set the direction (Arabic reads right to
                 left on an English screen too), not the screen's language. */
              dir="auto"
              value={draft.texts[s.id] ?? ""}
              onChange={(e) => setText(s.id, e.target.value)}
              rows={s.kind === "list" ? 4 : 3}
              maxLength={REPORT_LIMITS.text}
              placeholder={t(`tpl.${tpl.key}.s.${s.id}.hint`, "")}
              className={`${FIELD} min-h-[84px] resize-none overflow-y-auto leading-relaxed`}
            />
            <DictStatus t={t} listening={dictation.listening && dictSection === s.id} elapsed={dictation.elapsed}
              problem={dictProblem?.sid === s.id ? dictProblem.msg : null} onClose={() => setDictProblem(null)} />
            <SectionAiProposal t={t} slot={ai.slots[s.id]} current={draft.texts[s.id] ?? ""}
              onApply={(mode) => applyAi(s.id, mode)} onClose={() => ai.clear(s.id)} />
          </div>
        ))}

        <AttachmentsEditor t={t} reportId={id} initial={detail.attachments ?? []} onBusy={setAttBusy} hide={blockFiles} />
      </div>

      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className={`${CARD} space-y-4 p-4`}>
          {tpl.range ? (
            /* A trip or a visit (4D): its first and last day; the numbers
               (the trip's expenses) follow both. */
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{t("period.from")}</p>
                <DatePicker id="kx-rep-date" value={draft.date} onChange={(iso) => {
                  if (!iso) return;
                  const to = rangeEnd(iso, draftRef.current.dateTo);
                  change({ date: iso, dateTo: to });
                  if (tpl.sections.some((x) => x.kind === "data")) moveCarry(iso, `${iso}|${to}`, to);
                }} lang={lang} />
              </div>
              <div>
                <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{t("period.to")}</p>
                <DatePicker id="kx-rep-date-to" value={draft.dateTo} onChange={(iso) => {
                  if (!iso || !draftRef.current.date) return;
                  const to = rangeEnd(draftRef.current.date, iso);
                  change({ dateTo: to });
                  if (tpl.sections.some((x) => x.kind === "data")) moveCarry(draftRef.current.date, `${draftRef.current.date}|${to}`, to);
                }} lang={lang} />
              </div>
              {draft.date && draft.dateTo && draft.dateTo !== draft.date && <p className="text-[11.5px] text-[var(--text-dim)] tabular-nums">{periodLabel(draft.date, draft.dateTo)}</p>}
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">
                {tpl.cadence === "weekly" ? t("period.week") : tpl.cadence === "monthly" ? t("period.month") : tpl.cadence === "daily" ? t("period.day") : t("period.date")}
              </p>
              <DatePicker id="kx-rep-date" value={draft.date} onChange={(iso) => {
                if (!iso) return;
                const key = periodFor(tpl.cadence, iso).key;
                const moved = !!(carryRulesFor(tpl).length || appRulesFor(tpl).length || tpl.sections.some((x) => x.kind === "data")) && key !== (draftRef.current.date ? periodFor(tpl.cadence, draftRef.current.date).key : "");
                change({ date: iso });
                if (moved) moveCarry(iso, key);
              }} lang={lang} />
              {period && tpl.cadence && tpl.cadence !== "daily" && <p className="mt-1 text-[11.5px] text-[var(--text-dim)] tabular-nums">{periodLabel(period.start, period.end)}</p>}
            </div>
          )}
          <PeopleField t={t} label={t("composer.to")} ids={draft.to} people={people} nameOf={nameOf}
            onChange={(to) => change({ to, cc: draftRef.current.cc.filter((x) => !to.includes(x)) })} hint={t("composer.defaultTo")} />
          <PeopleField t={t} label={t("composer.cc")} ids={draft.cc} people={people.filter((p) => !draft.to.includes(p.id))} nameOf={nameOf}
            onChange={(cc) => change({ cc })} />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{t("composer.confidential")}</p>
              <p className="text-[11.5px] text-[var(--text-dim)]">{t("composer.confidentialHint")}</p>
            </div>
            <button type="button" role="switch" aria-checked={draft.confidential} aria-label={t("composer.confidential")} disabled={tpl.confidential}
              onClick={() => change({ confidential: !draftRef.current.confidential })}
              className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60 ${draft.confidential ? "bg-emerald-500" : "bg-[var(--bg-surface-subtle)] ring-1 ring-inset ring-[var(--border-subtle)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200 ${draft.confidential ? "start-[22px]" : "start-0.5"}`} />
            </button>
          </div>
          {tpl.reviewRequired && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-500">{t("composer.reviewHint")}</p>}
        </div>

        <div className={`${CARD} space-y-2 p-4`}>
          {problem && <p role="alert" className="text-[12.5px] text-red-500">{problem}</p>}
          <button type="button" onClick={() => void send()} disabled={sending || uploading}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--bg-inverted)] text-[13px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">
            {sending || uploading ? <SpinnerIcon size={14} /> : <RrIcon name="paper-plane" size={14} />}{sending ? t("composer.sending") : uploading ? t("attach.uploading") : t("composer.send")}
          </button>
          <button type="button" onClick={() => { dirty.current = true; void flush(); }} disabled={save.state === "saving" || sending}
            className="flex h-9 w-full items-center justify-center rounded-xl border border-[var(--border-subtle)] text-[12.5px] font-medium text-[var(--text-secondary)] disabled:opacity-60">
            {t("composer.saveDraft")}
          </button>
          <p className="min-h-[16px] text-center text-[11px] text-[var(--text-dim)] tabular-nums" aria-live="polite">
            {save.state === "saving" ? t("composer.saving") : save.state === "saved" ? `${t("composer.saved")} · ${dmyTime(save.at)}` : save.state === "error" ? t("err.saveFailed") : ""}
          </p>
          {!confirmDelete ? (
            /* A quiet destructive action: text at rest, a rounded red wash on
               hover. data-kx-keep-hover opts it out of Aurora's generic
               control hover, whose 3% fill landed as a square grey slab on a
               borderless, unrounded text button — the hatch that rule keeps
               for a control whose hover colour means something (destructive).
               Same h-9 / rounded-xl as Save draft, so the hover has a
               button's shape. */
            <button type="button" data-kx-keep-hover onClick={() => setConfirmDelete(true)}
              className="flex h-9 w-full items-center justify-center rounded-xl text-[12px] font-medium text-[var(--text-dim)] transition-colors hover:bg-red-500/10 hover:text-red-500">{t("composer.delete")}</button>
          ) : (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-[12px] text-[var(--text-secondary)]">
              <p>{t("composer.deleteConfirm")}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void remove()} className="rounded-lg bg-red-500/85 px-3 py-1.5 font-semibold text-white">{t("composer.delete")}</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5">{t("composer.cancel")}</button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function PeopleField({ t, label, ids, people, nameOf, onChange, hint }: {
  t: T; label: string; ids: string[]; people: ReportPerson[]; nameOf: Map<string, ReportPerson>;
  onChange: (ids: string[]) => void; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return people.filter((p) => !ids.includes(p.id) && (!s || p.name.toLowerCase().includes(s) || (p.nameAlt ?? "").toLowerCase().includes(s))).slice(0, 8);
  }, [people, ids, q]);
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((pid) => {
          const p = nameOf.get(pid);
          return (
            <span key={pid} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] py-0.5 ps-0.5 pe-1 text-[12px] text-[var(--text-primary)]">
              <Avatar person={{ name: p?.name ?? "?", avatar: p?.avatar ?? null }} size={20} />
              <span className="max-w-[140px] truncate">{p?.name ?? "—"}</span>
              <button type="button" onClick={() => onChange(ids.filter((x) => x !== pid))} aria-label={`${label}: ${p?.name ?? ""} ×`} className="grid h-5 w-5 place-items-center rounded-full text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                <RrIcon name="cross" size={9} />
              </button>
            </span>
          );
        })}
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
          <RrIcon name="plus" size={10} />{t("composer.addPeople")}
        </button>
      </div>
      {hint && ids.length > 0 && <p className="mt-1 text-[11px] text-[var(--text-faint)]">{hint}</p>}
      {open && (
        <div className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("composer.searchPeople")} className={`${FIELD} h-8 py-1`} aria-label={t("composer.searchPeople")} />
          <ul className="mt-1 max-h-56 overflow-y-auto">
            {matches.length === 0 && <li className="px-2 py-2 text-[12px] text-[var(--text-dim)]">{t("composer.noPeople")}</li>}
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { onChange([...ids, p.id]); setQ(""); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[12.5px] hover:bg-[var(--bg-surface)]">
                  <Avatar person={p} size={22} />
                  <span className="min-w-0">
                    <span className="block truncate text-[var(--text-primary)]">{p.name}</span>
                    {p.position && <span className="block truncate text-[10.5px] text-[var(--text-dim)]">{p.position}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Reader ────────────────────────────────────────────────────────────── */

/* The house print recipe: the /print route in an off-screen iframe (never
   visibility:hidden — some browsers skip invisible frames), printed once it
   says it is ready. Printing this window instead would drag the Hub layout
   into the print pass. */
function printReport(id: string, lang: string) {
  const FRAME_ID = "koleex-report-print-frame";
  let frame = document.getElementById(FRAME_ID) as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = FRAME_ID;
    Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "210mm", height: "270mm", border: "none" });
    document.body.appendChild(frame);
  }
  const f = frame;
  const onLoad = () => {
    f.removeEventListener("load", onLoad);
    let tries = 0;
    const ready = () => {
      const win = f.contentWindow as (Window & { __quotation_pdf_ready__?: boolean }) | null;
      if (win?.__quotation_pdf_ready__) { win.focus(); win.print(); }
      /* Up to 30 s: the paper waits for its photos, and on a slow line they take a moment. */
      else if (++tries < 300) setTimeout(ready, 100);
    };
    ready();
  };
  f.addEventListener("load", onLoad);
  f.src = `/reports/${encodeURIComponent(id)}/print?lang=${lang}&_t=${Date.now()}`;
}

function Reader({ t, lang, detail, blocks, onChange }: { t: T; lang: string; detail: ReportDetail; blocks: BlocksModule | null; onChange: () => Promise<void> }) {
  const router = useRouter();
  const { report, recipients, can } = detail;
  const tpl = typeOf(detail);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [returning, setReturning] = useState(false);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState(detail.comments);
  const [problem, setProblem] = useState<string | null>(null);

  const act = async (action: "approve" | "return" | "acknowledge") => {
    setBusy(action); setProblem(null);
    const res = await decideReport(report.id, action, action === "return" ? note : undefined);
    setBusy(null);
    if (res.ok) { setReturning(false); setNote(""); await onChange(); }
    else setProblem(res.error === "already_decided" ? t("err.alreadyDecided") : res.error === "forbidden" ? t("err.forbidden") : t("err.generic"));
  };
  const revise = async () => {
    setBusy("revise"); setProblem(null);
    const res = await reviseReport(report.id);
    setBusy(null);
    if (res.ok) router.push(`/reports/${res.data.id}`);
    else setProblem(t("err.generic"));
  };
  const addComment = async () => {
    const body = comment.trim();
    if (!body) return;
    setBusy("comment"); setProblem(null);
    const res = await commentOnReport(report.id, body);
    setBusy(null);
    if (res.ok) { setComments((c) => [...c, res.data.comment]); setComment(""); }
    else setProblem(t("err.generic"));
  };

  const to = recipients.filter((r) => r.role === "to");
  const cc = recipients.filter((r) => r.role === "cc");
  const hasActions = can.decide || can.acknowledge || can.revise;
  /* The photos a block shows in place (Phase 4A) are not listed again. */
  const readerBlockFiles = blockFileIds(report.sections);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <article className="min-w-0 space-y-3">
        <header className={`${CARD} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#567FB2]/12 text-[#9DBCE0]"><TemplateIcon icon={tpl?.icon} size={16} /></span>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-semibold leading-snug text-[var(--text-primary)]">
                {report.title.trim() ? <AutoTranslatedText text={report.title} plain /> : tplName(t, report.templateKey)}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-dim)]">
                {report.title.trim() && <span>{tplName(t, report.templateKey)} ·</span>}
                <span className="tabular-nums">{periodLabel(report.periodStart, report.periodEnd)}</span>
                {report.submittedAt && <span className="tabular-nums">· {t("reader.sentAt")} {dmyTime(report.submittedAt)}</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {tpl?.urgent && <Badge tone="danger">{t("badge.urgent")}</Badge>}
              {report.confidential && <Badge>{t("badge.confidential")}</Badge>}
              {report.version > 1 && <Badge tone="accent">{t("badge.version")} {report.version}</Badge>}
              <StatusChip status={report.status} t={t} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[12.5px]">
            <Avatar person={report.author} size={26} />
            <span className="text-[var(--text-dim)]">{t("reader.from")}</span>
            <span className="font-medium text-[var(--text-primary)]">{report.author.name}</span>
          </div>
        </header>

        {report.superseded && (
          <p className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-[12.5px] text-amber-500">
            {t("reader.superseded")}
            {report.newerId && <Link href={`/reports/${report.newerId}`} className="font-semibold underline">{t("badge.version")} {report.version + 1}</Link>}
          </p>
        )}

        {(tpl?.sections ?? []).map((s) => {
          const v = report.sections.find((x) => x.id === s.id);
          if (isBlock(s.kind)) {
            return (
              <section key={s.id} className={`${CARD} p-4 sm:p-5`}>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">{t(`tpl.${report.templateKey}.s.${s.id}`)}</h2>
                {blocks && <blocks.BlockView t={t} tplKey={report.templateKey} def={s} value={v} version={report.version} />}
              </section>
            );
          }
          const items = v?.items ?? [];
          const text = v?.text?.trim() ?? "";
          const empty = s.kind === "list" ? items.length === 0 : !text;
          return (
            <section key={s.id} className={`${CARD} p-4 sm:p-5`}>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">{t(`tpl.${report.templateKey}.s.${s.id}`)}</h2>
              {empty ? (
                <p className="text-[13px] text-[var(--text-faint)]">{t("reader.empty")}</p>
              ) : s.kind === "list" ? (
                <ul className="list-disc space-y-1 ps-5 text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                  {items.map((item, i) => <li key={i}><AutoTranslatedText text={item} plain /></li>)}
                </ul>
              ) : (
                <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text-primary)]"><AutoTranslatedText text={v?.text ?? ""} block /></div>
              )}
            </section>
          );
        })}

        <AttachmentsView t={t} attachments={(detail.attachments ?? []).filter((a) => !readerBlockFiles.has(a.id))} />

        <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="kx-rep-thread">
          <h2 id="kx-rep-thread" className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">{t("reader.comments")}</h2>
          {comments.length === 0 ? <p className="text-[12.5px] text-[var(--text-dim)]">{t("reader.noComments")}</p> : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar person={c.author} size={26} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="font-medium text-[var(--text-primary)]">{c.author.name}</span>
                      {c.kind !== "comment" && <Badge tone={c.kind === "approved" ? "accent" : "warn"}>{c.kind === "approved" ? t("reader.decisionApproved") : t("reader.decisionReturned")}</Badge>}
                      <span className="text-[var(--text-faint)] tabular-nums">{dmyTime(c.createdAt)}</span>
                    </p>
                    {c.body.trim() && <div className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-secondary)]"><AutoTranslatedText text={c.body} block /></div>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {can.comment && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <textarea id="kx-rep-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={REPORT_LIMITS.comment}
                placeholder={t("reader.commentPlaceholder")} className={`${FIELD} min-h-[60px] flex-1 resize-y`} aria-label={t("reader.commentPlaceholder")} />
              <button type="button" onClick={() => void addComment()} disabled={!comment.trim() || busy === "comment"}
                className="grid h-9 shrink-0 place-items-center rounded-xl border border-[var(--border-subtle)] px-4 text-[12.5px] font-medium text-[var(--text-primary)] disabled:opacity-50">
                {busy === "comment" ? <SpinnerIcon size={13} /> : t("reader.commentSend")}
              </button>
            </div>
          )}
          {!hasActions && problem && <p role="alert" className="mt-2 text-[12.5px] text-red-500">{problem}</p>}
        </section>
      </article>

      {/* ON A PHONE THE DECISION COMES FIRST. The grid is one column there, so
          the aside dissolves (display: contents) and the decision card moves
          above the report while the readers and Print stay after it. Measured
          25/09/2026: a real reviewer on an iPhone approved three reports she
          had been asked to return — the card sat under the whole report and
          the comment box, with Approve the only strong button in it. Now the
          two choices are equal in size and weight, side by side. */}
      <aside className="contents lg:block lg:space-y-3 lg:sticky lg:top-4 lg:self-start">
        {hasActions && (
          <div className={`${CARD} order-first space-y-2 p-4 lg:order-none`}>
            {problem && <p role="alert" className="text-[12.5px] text-red-500">{problem}</p>}
            {can.decide && !returning && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">{t("reader.decisionTitle")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => void act("approve")} disabled={!!busy}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--bg-inverted)] px-2 text-[13px] font-semibold leading-tight text-[var(--text-inverted)] disabled:opacity-60">
                    {busy === "approve" ? <SpinnerIcon size={14} /> : <RrIcon name="check" size={14} />}{t("reader.approve")}
                  </button>
                  <button type="button" onClick={() => setReturning(true)} disabled={!!busy}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/10 px-2 text-[13px] font-semibold leading-tight text-amber-500 disabled:opacity-60">
                    <span className="inline-flex rtl:rotate-180"><RrIcon name="arrow-left" size={14} /></span>{t("reader.returnShort")}
                  </button>
                </div>
              </>
            )}
            {can.decide && returning && (
              <div className="space-y-2">
                <textarea id="kx-rep-return" autoFocus value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t("reader.returnNote")} className={`${FIELD} resize-y`} aria-label={t("reader.returnNote")} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => void act("return")} disabled={note.trim().length < 3 || !!busy}
                    className="flex h-9 flex-1 items-center justify-center rounded-xl bg-amber-500 text-[12.5px] font-semibold text-black disabled:opacity-50">
                    {busy === "return" ? <SpinnerIcon size={13} /> : t("reader.returnSend")}
                  </button>
                  <button type="button" onClick={() => { setReturning(false); setNote(""); }} className="h-9 rounded-xl border border-[var(--border-subtle)] px-3 text-[12.5px]">{t("composer.cancel")}</button>
                </div>
              </div>
            )}
            {can.acknowledge && !can.decide && (
              <button type="button" onClick={() => void act("acknowledge")} disabled={!!busy}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--bg-inverted)] text-[13px] font-semibold text-[var(--text-inverted)] disabled:opacity-60">
                {busy === "acknowledge" ? <SpinnerIcon size={14} /> : <RrIcon name="check" size={14} />}{t("reader.acknowledge")}
              </button>
            )}
            {can.revise && (
              <button type="button" onClick={() => void revise()} disabled={!!busy}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] text-[12.5px] font-medium text-[var(--text-secondary)] disabled:opacity-60">
                {busy === "revise" ? <SpinnerIcon size={13} /> : <RrIcon name="pencil" size={13} />}{t("reader.newVersion")}
              </button>
            )}
          </div>
        )}

        <div className={`${CARD} space-y-3 p-4`}>
          <RecipientList t={t} label={t("reader.to")} list={to} />
          {cc.length > 0 && <RecipientList t={t} label={t("reader.cc")} list={cc} />}
          {report.decidedBy && (
            <p className="border-t border-[var(--border-subtle)] pt-3 text-[12px] text-[var(--text-dim)]">
              {report.status === "approved" ? t("reader.approvedBy") : t("reader.returnedBy")} · <span className="text-[var(--text-primary)]">{report.decidedBy.name}</span> · <span className="tabular-nums">{dmyTime(report.decidedAt)}</span>
            </p>
          )}
        </div>

        <button type="button" onClick={() => printReport(report.id, lang)} className={`${CARD} flex w-full items-center justify-center gap-2 p-3 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]`}>
          <RrIcon name="print" size={14} />{t("reader.print")}
        </button>
      </aside>
    </div>
  );
}

function RecipientList({ t, label, list }: { t: T; label: string; list: ReportRecipient[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">{label}</p>
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <Avatar person={r} size={24} />
            <div className="min-w-0">
              <p className="truncate text-[12.5px] text-[var(--text-primary)]">{r.name}</p>
              <p className="text-[10.5px] text-[var(--text-dim)] tabular-nums">
                {r.acknowledgedAt ? `${t("reader.acknowledgedAt")} · ${dmyTime(r.acknowledgedAt)}` : r.readAt ? `${t("reader.readAt")} · ${dmyTime(r.readAt)}` : t("reader.notRead")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
