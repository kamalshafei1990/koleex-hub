"use client";

/* ---------------------------------------------------------------------------
   Reports — the template builder (Phase 4E, owner's picks, 25 Sep 2026).
   The Templates tab: its own chunk, opened only by super admins and whoever
   holds "Report Templates" in Roles (the server checks every action again).

   The list: the types made here (edit, archive / offer again, delete while
   no report uses one) and the ready-made types (copy one to change it — the
   original stays; hide the ones nobody uses — their old reports stay; the
   daily, weekly and monthly are the compliance board's and always offered).

   The editor: the name and description, the settings (group, icon, what it
   covers, who it goes to, review, confidential, urgent, its own title, HR
   only) and the sections — every block the engine has — each named in
   English, Chinese and Arabic. The words are written in one language at a
   time; "Fill the other languages" asks Koleex AI for the rest (the author
   checks them before saving). The same rules as the server
   (checkTemplate) say what is still missing before a save. Saving an edit
   raises the type's version: reports already started keep the version they
   were written with.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import type { Lang } from "@/lib/i18n";
import { reportBuilderT } from "@/lib/translations/report-builder";
import { reportBlocksT } from "@/lib/translations/report-blocks";
import { reportComposerT } from "@/lib/translations/report-ui/composer";
import { reportDescsT } from "@/lib/translations/report-descs";
import {
  REPORT_FAMILIES, REPORT_LINK_TYPES,
  type ReportColumnType, type ReportDataSource, type ReportFamily, type ReportLinkType, type ReportSectionDef, type ReportSectionKind,
} from "@/lib/reports/templates";
import { REPORT_TEMPLATES } from "@/lib/reports/catalog";
import { SOURCE_GROUPS } from "@/lib/reports/report-data";
import {
  BUILDER_LIMITS, ICON_CHOICES, SECTION_KINDS, UNHIDEABLE, checkTemplate, copyableBuiltin, hideableBuiltin, newSectionId, nextId, wordSlots, type CustomDef,
} from "@/lib/reports/custom-templates";
import { isWritten, pickWord, type TemplateWords, type Word } from "@/lib/reports/template-words";
import {
  createTemplate, deleteTemplate, fetchTemplateDoc, fetchTemplates, saveTemplate, setBuiltinHidden, setTemplateStatus,
  type TemplateDoc, type TemplateList,
} from "@/lib/work-reports";
import { Badge, CARD, FIELD, type T } from "./shared";

const LANGS: Lang[] = ["en", "zh", "ar"];
const LANG_LABEL: Record<Lang, string> = { en: "English", zh: "中文", ar: "العربية" };
/* Selection is an outline (Aurora turns it into the Hub Blue ring). */
const SEL = "kx-seg-on border-[#567FB2]/50 bg-[#567FB2]/12 text-[var(--text-primary)]";
const OFF = "kx-seg-off border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)]";
const BTN = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50";
const PRIMARY = "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3.5 text-[12px] font-semibold text-[var(--text-inverted)] disabled:opacity-60";
const ICON_BTN = "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-30";
const KIND_ICON: Record<ReportSectionKind, RrIconName> = {
  text: "document", list: "clipboard", checklist: "badge-check", score: "award", table: "calculator",
  choice: "check", links: "arrow-up-right-from-square", data: "coins", signature: "signature",
};
const COLUMN_TYPES: ReportColumnType[] = ["text", "number", "money", "date"];
/* A field that sits beside another in a row: its own width, not the whole row. */
const FIELD_INLINE = FIELD.replace("w-full ", "");
/* A missing word is ringed on its wrapper: the skin styles the field's own
   border (Aurora's recessed well), never a plain wrapper. */
const MISSING = "rounded-xl ring-1 ring-amber-500/70";

const blankDoc = (): TemplateDoc => ({
  key: null,
  def: {
    family: "work", icon: "document", cadence: null, range: false, recipients: "manager", reviewRequired: false,
    confidential: false, urgent: false, customTitle: false, hrOnly: false, teamOnly: false, officeOnly: false, payrollOnly: false, mgmtOnly: false, sections: [{ id: "s1", kind: "text", required: true }],
  },
  words: {},
});

export default function TemplatesTab({ t: shared, lang, onChanged }: { t: T; lang: string; onChanged: () => void }) {
  const l = (LANGS.find((x) => x === lang) ?? "en") as Lang;
  /* The builder's own words first (and the blocks' — link kinds, 5B — the
     composer's few it shares, and the built-ins' one-line descriptions, which
     the home only loads after its first paint), then the home's (groups, type
     names). */
  const t = useCallback<T>((key, fallback) => {
    const e = reportBuilderT[key] ?? reportBlocksT[key] ?? reportComposerT[key] ?? reportDescsT[key];
    return e ? (e[l] ?? e.en) : shared(key, fallback);
  }, [shared, l]);
  const [list, setList] = useState<TemplateList | null>(null);
  const [failed, setFailed] = useState(false);
  const [doc, setDoc] = useState<TemplateDoc | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ key: string; msg: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [family, setFamily] = useState<ReportFamily | "all">("all");

  const load = useCallback(async () => {
    const res = await fetchTemplates();
    if (res.ok) { setList(res.data); setFailed(false); } else setFailed(true);
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const open = async (key: string, asCopy: boolean) => {
    setBusy(key); setNote(null);
    const res = await fetchTemplateDoc(key);
    setBusy(null);
    if (!res.ok) { setNote({ key, msg: t("err.generic") }); return; }
    if (!asCopy) { setDoc(res.data); return; }
    /* A copy starts as "<name> (copy)" in every language it has. */
    const name: Word = {};
    for (const x of LANGS) {
      const v = res.data.words.name?.[x];
      if (v) name[x] = (reportBuilderT["tb.copyName"][x] ?? "{name}").replace("{name}", v).slice(0, BUILDER_LIMITS.name);
    }
    setDoc({ ...res.data, key: null, status: undefined, version: undefined, words: { ...res.data.words, name } });
  };

  const act = async (key: string, run: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(key); setNote(null);
    const res = await run();
    setBusy(null);
    setConfirmDelete(null);
    if (!res.ok) { setNote({ key, msg: res.error === "in_use" ? t("tb.inUse") : t("err.generic") }); return; }
    await load();
    onChanged();
  };

  if (doc) {
    return <Editor t={t} lang={l} doc={doc} onClose={(saved) => { setDoc(null); if (saved) { void load(); onChanged(); } }} />;
  }
  if (failed && !list) {
    return <div className={`${CARD} px-5 py-8 text-center text-[13px] text-[var(--text-dim)]`}>{t("err.generic")} <button type="button" onClick={() => void load()} className="ms-2 underline">↻</button></div>;
  }
  if (!list) return <div className={`${CARD} grid place-items-center py-14`}><SpinnerIcon size={18} /></div>;

  const hidden = new Set(list.hidden);
  const builtins = REPORT_TEMPLATES.filter((x) => copyableBuiltin(x.key) && (family === "all" || x.family === family));
  const periodWord = (c: string | null) => t(`tb.period.${c ?? "none"}`);

  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="kx-tb-mine">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-[70ch]">
            <h2 id="kx-tb-mine" className="text-[14px] font-semibold text-[var(--text-primary)]">{t("tb.mine")}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-dim)]">{t("tb.lead")}</p>
          </div>
          {list.can.create && (
            <button type="button" onClick={() => setDoc(blankDoc())} className={PRIMARY}><RrIcon name="plus" size={12} />{t("tb.new")}</button>
          )}
        </div>
        {list.custom.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-[12.5px] text-[var(--text-dim)]">{t("tb.mineEmpty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
            {list.custom.map((c) => {
              const name = pickWord(c.name, l) || t("tb.unnamed");
              const archived = c.status === "archived";
              return (
                <li key={c.key} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${archived ? "bg-[var(--bg-surface-subtle)] text-[var(--text-faint)]" : "bg-[#567FB2]/12 text-[#9DBCE0]"}`}><RrIcon name={c.icon} size={14} /></span>
                  {/* The name keeps room to be read; on a phone the buttons move under it. */}
                  <span className="min-w-[11rem] flex-1">
                    <span className={`block truncate text-[13px] font-semibold ${archived ? "text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>{name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[var(--text-dim)]">
                      <span>{t(`family.${c.family}`)}</span>
                      <span>· {periodWord(c.cadence)}</span>
                      {c.version && c.version > 1 && <span className="tabular-nums">· {t("tb.version").replace("{n}", String(c.version))}</span>}
                    </span>
                  </span>
                  {archived && <Badge>{t("tb.archived")}</Badge>}
                  <span className="ms-auto flex flex-wrap items-center gap-1.5">
                    {busy === c.key && <SpinnerIcon size={12} />}
                    {confirmDelete === c.key ? (
                      <>
                        <span className="text-[12px] text-[var(--text-secondary)]">{t("tb.deleteConfirm")}</span>
                        <button type="button" disabled={!!busy} onClick={() => void act(c.key, () => deleteTemplate(c.key))} className={`${BTN} border-red-500/40 text-red-400`}>{t("tb.delete")}</button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className={BTN}>{t("composer.cancel")}</button>
                      </>
                    ) : (
                      <>
                        {list.can.edit && !archived && <button type="button" disabled={!!busy} onClick={() => void open(c.key, false)} className={BTN}><RrIcon name="pencil" size={11} />{t("tb.edit")}</button>}
                        {list.can.edit && (
                          <button type="button" disabled={!!busy} onClick={() => void act(c.key, () => setTemplateStatus(c.key, archived ? "active" : "archived"))} className={BTN}>
                            {archived ? t("tb.restore") : t("tb.archive")}
                          </button>
                        )}
                        {list.can.delete && <button type="button" disabled={!!busy} onClick={() => setConfirmDelete(c.key)} aria-label={t("tb.delete")} title={t("tb.delete")} className={ICON_BTN}><RrIcon name="trash" size={12} /></button>}
                      </>
                    )}
                  </span>
                  {note?.key === c.key && <p className="basis-full text-[12px] text-amber-500">{note.msg}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="kx-tb-builtin">
        <h2 id="kx-tb-builtin" className="text-[14px] font-semibold text-[var(--text-primary)]">{t("tb.builtin")}</h2>
        <p className="mt-1 max-w-[70ch] text-[12.5px] leading-relaxed text-[var(--text-dim)]">{t("tb.builtinLead")}</p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("tb.group")}>
          {(["all", ...REPORT_FAMILIES.filter((f) => REPORT_TEMPLATES.some((x) => x.family === f && copyableBuiltin(x.key)))] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={family === f} onClick={() => setFamily(f)}
              className={`h-7 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors ${family === f ? SEL : OFF}`}>
              {f === "all" ? t("tb.all") : t(`family.${f}`)}
            </button>
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {builtins.map((x) => {
            const isHidden = hidden.has(x.key);
            return (
              <li key={x.key} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isHidden ? "bg-[var(--bg-surface)] text-[var(--text-faint)]" : "bg-[#567FB2]/12 text-[#9DBCE0]"}`}><RrIcon name={x.icon} size={14} /></span>
                <span className="min-w-[11rem] flex-1">
                  <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${isHidden ? "text-[var(--text-dim)]" : "text-[var(--text-primary)]"}`}>
                    <span className="truncate">{t(`tpl.${x.key}.name`)}</span>
                    {isHidden && <Badge>{t("tb.hidden")}</Badge>}
                  </span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-dim)]" title={t(`tpl.${x.key}.desc`, "")}>
                    {UNHIDEABLE.includes(x.key) ? t("tb.tracked") : t(`tpl.${x.key}.desc`, "")}
                  </span>
                </span>
                <span className="ms-auto flex items-center gap-1.5">
                  {busy === x.key && <SpinnerIcon size={12} />}
                  {list.can.create && <button type="button" disabled={!!busy} onClick={() => void open(x.key, true)} className={BTN}><RrIcon name="file" size={11} />{t("tb.copy")}</button>}
                  {list.can.edit && hideableBuiltin(x.key) && (
                    <button type="button" disabled={!!busy} onClick={() => void act(x.key, () => setBuiltinHidden(x.key, !isHidden))} className={BTN}>
                      <RrIcon name="eye" size={11} />{isHidden ? t("tb.show") : t("tb.hide")}
                    </button>
                  )}
                </span>
                {note?.key === x.key && <p className="basis-full text-[12px] text-amber-500">{note.msg}</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* ── The editor ────────────────────────────────────────────────────────── */

interface Ctx {
  t: T;
  editLang: Lang;
  /** The word in the language being written, and a placeholder from another. */
  w: (key: string) => string;
  ph: (key: string, fallback: string) => string;
  setW: (key: string, value: string) => void;
  /** Still missing — shown once a save was tried. */
  bad: (key: string) => boolean;
}

function Editor({ t, lang, doc, onClose }: { t: T; lang: Lang; doc: TemplateDoc; onClose: (saved: boolean) => void }) {
  const [def, setDef] = useState<CustomDef>(doc.def);
  const [words, setWords] = useState<TemplateWords>(doc.words);
  const [editLang, setEditLang] = useState<Lang>(lang);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [fill, setFill] = useState<"idle" | "busy" | "done" | "none" | "failed">("idle");
  const [adding, setAdding] = useState(false);

  const check = useMemo(() => checkTemplate(def, words), [def, words]);
  const slots = useMemo(() => wordSlots(def), [def]);
  const missing = useMemo(() => Object.fromEntries(LANGS.map((x) => [x, slots.filter((s) => isWritten(words[s.key]) && !words[s.key]?.[x]?.trim()).length])) as Record<Lang, number>, [slots, words]);
  const problems = useMemo(() => new Set(check.problems), [check.problems]);

  const setW = useCallback((key: string, value: string) => {
    setWords((ws) => ({ ...ws, [key]: { ...ws[key], [editLang]: value } }));
    setDirty(true);
  }, [editLang]);
  const ctx: Ctx = {
    t, editLang, setW,
    w: (key) => words[key]?.[editLang] ?? "",
    ph: (key, fallback) => pickWord(words[key], editLang) || fallback,
    bad: (key) => tried && problems.has(key),
  };
  const patch = (p: Partial<CustomDef>) => { setDef((d) => ({ ...d, ...p })); setDirty(true); };
  const patchSection = (id: string, fn: (s: ReportSectionDef) => ReportSectionDef) => patch({ sections: def.sections.map((s) => (s.id === id ? fn(s) : s)) });
  const dropWords = (prefix: string) => setWords((ws) => Object.fromEntries(Object.entries(ws).filter(([k]) => k !== prefix && !k.startsWith(`${prefix}.`))));

  const addSection = (kind: ReportSectionKind) => {
    const id = newSectionId(def.sections.map((s) => s.id));
    const s: ReportSectionDef = { id, kind, required: false };
    if (kind === "checklist" || kind === "score") s.points = [{ id: "p1" }];
    if (kind === "table") { s.columns = [{ id: "c1", type: "text" }, { id: "c2", type: "number" }]; s.summary = "total"; }
    if (kind === "choice") s.options = ["o1", "o2"];
    if (kind === "links") s.linkTypes = [...REPORT_LINK_TYPES];
    patch({ sections: [...def.sections, s] });
    setAdding(false);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...def.sections];
    const [s] = next.splice(i, 1);
    next.splice(i + by, 0, s);
    patch({ sections: next });
  };
  const remove = (id: string) => { patch({ sections: def.sections.filter((s) => s.id !== id) }); dropWords(`s.${id}`); };

  /* Koleex AI fills what is written in one language into the others — a
     proposal in the fields, checked by the author before saving. A word it
     could not translate (it comes back unchanged) stays empty. */
  const fillOthers = async () => {
    setFill("busy");
    const maxOf = new Map(slots.map((s) => [s.key, s.max]));
    const jobs = new Map<string, { src: Lang; target: Lang; keys: string[]; texts: string[] }>();
    for (const slot of slots) {
      const wd = words[slot.key];
      if (!isWritten(wd)) continue;
      const src = (["en", editLang, "ar", "zh"] as Lang[]).find((x) => wd?.[x]?.trim())!;
      for (const target of LANGS) {
        if (target === src || wd?.[target]?.trim()) continue;
        const id = `${src}>${target}`;
        const job = jobs.get(id) ?? { src, target, keys: [], texts: [] };
        job.keys.push(slot.key); job.texts.push(wd![src]!.trim());
        jobs.set(id, job);
      }
    }
    if (!jobs.size) { setFill("none"); return; }
    const calls: Array<Promise<Array<[string, Lang, string]> | null>> = [];
    for (const job of jobs.values()) {
      for (let i = 0; i < job.texts.length; i += 40) {
        const texts = job.texts.slice(i, i + 40);
        const keys = job.keys.slice(i, i + 40);
        calls.push(fetch("/api/ai/translate", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts, target_lang: job.target, source_lang: job.src }),
        }).then(async (res) => {
          const json = (await res.json().catch(() => null)) as { translations?: unknown[] } | null;
          if (!res.ok || !Array.isArray(json?.translations)) return null;
          return json.translations.flatMap((out, n): Array<[string, Lang, string]> =>
            typeof out === "string" && out.trim() && out.trim() !== texts[n] ? [[keys[n], job.target, out.trim().slice(0, maxOf.get(keys[n]) ?? BUILDER_LIMITS.label)]] : []);
        }).catch(() => null));
      }
    }
    const results = await Promise.all(calls);
    const got = results.flatMap((r) => r ?? []);
    if (got.length) {
      setWords((ws) => {
        const next = { ...ws };
        for (const [k, x, v] of got) if (!next[k]?.[x]?.trim()) next[k] = { ...next[k], [x]: v };
        return next;
      });
      setDirty(true);
    }
    setFill(got.length ? "done" : results.some((r) => r === null) ? "failed" : "none");
  };

  const save = async () => {
    setTried(true);
    setProblem(null);
    if (check.problems.length) return;
    setSaving(true);
    const res = doc.key
      ? await saveTemplate(doc.key, check.def, check.words, doc.version ?? 1)
      : await createTemplate(check.def, check.words);
    setSaving(false);
    if (res.ok) { onClose(true); return; }
    setProblem(res.error === "changed" ? t("tb.changed") : res.error === "too_many" ? t("tb.tooMany") : t("err.generic"));
  };

  /* What is still missing, said once per kind of gap. */
  const gaps = useMemo(() => {
    const out = new Set<string>();
    for (const p of check.problems) {
      if (p === "no_sections" || p === "name") out.add(`tb.p.${p}`);
      else if (/^s\.[^.]+$/.test(p)) out.add("tb.p.label");
      else if (/^s\.[^.]+\.[ico]\./.test(p)) out.add("tb.p.item");
      else out.add(`tb.p.${p.split(":")[0]}`);
    }
    return Array.from(out);
  }, [check.problems]);

  const base = def.base;
  const tracked = !!base && UNHIDEABLE.includes(base);
  const period = def.range ? "range" : def.cadence ?? "none";

  return (
    <div className="space-y-4">
      <header className={`${CARD} sticky top-2 z-10 flex flex-wrap items-center gap-3 p-3 sm:p-4`}>
        <button type="button" onClick={() => (dirty ? setLeaving(true) : onClose(false))} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">
          <span className="inline-block rtl:rotate-180"><RrIcon name="arrow-left" size={13} /></span>{t("tb.title")}
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{doc.key ? t("tb.editTitle") : t("tb.newTitle")}</h2>
          <p className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-[var(--text-dim)]">
            {base && <span>{t("tb.copiedFrom").replace("{name}", t(`tpl.${base}.name`))}</span>}
            {doc.key && doc.version && <span className="tabular-nums">{t("tb.version").replace("{n}", String(doc.version))}</span>}
          </p>
        </div>
        {leaving ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-[var(--text-secondary)]">{t("tb.discard")}</span>
            <button type="button" onClick={() => onClose(false)} className={`${BTN} border-red-500/40 text-red-400`}>{t("tb.discardYes")}</button>
            <button type="button" onClick={() => setLeaving(false)} className={BTN}>{t("composer.cancel")}</button>
          </span>
        ) : (
          <button type="button" disabled={saving} onClick={() => void save()} className={PRIMARY}>{saving && <SpinnerIcon size={11} />}{saving ? t("tb.saving") : t("tb.save")}</button>
        )}
        {tried && gaps.length > 0 && (
          <p className="basis-full text-[12px] text-amber-500">{t("tb.problems")} {gaps.map((g) => t(g)).join(" · ")}</p>
        )}
        {problem && <p className="basis-full text-[12px] text-red-400">{problem}</p>}
      </header>

      {(doc.key || tracked) && (
        <p className="rounded-xl border border-[#567FB2]/30 bg-[#567FB2]/10 px-4 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          {doc.key ? t("tb.editNote") : t("tb.copyNote")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <section className={`${CARD} space-y-3 p-4`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{t("tb.lang")}</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("tb.lang")}>
                {LANGS.map((x) => (
                  <button key={x} type="button" role="radio" aria-checked={editLang === x} onClick={() => setEditLang(x)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors ${editLang === x ? SEL : OFF}`}>
                    {LANG_LABEL[x]}
                    {missing[x] > 0 && <span className="rounded bg-amber-500/15 px-1 text-[10px] tabular-nums text-amber-500">{t("tb.missing").replace("{n}", String(missing[x]))}</span>}
                  </button>
                ))}
              </div>
              <button type="button" disabled={fill === "busy"} onClick={() => void fillOthers()} className={`kx-ai-glow ${BTN} ms-auto border-[#567FB2]/40`}>
                {fill === "busy" ? <SpinnerIcon size={11} /> : <RrIcon name="bulb" size={11} />}{fill === "busy" ? t("tb.filling") : t("tb.fill")}
              </button>
              {fill === "done" && <p className="basis-full text-[11.5px] text-[var(--text-dim)]">{t("tb.fillDone")}</p>}
              {fill === "none" && <p className="basis-full text-[11.5px] text-[var(--text-dim)]">{t("tb.fillNone")}</p>}
              {fill === "failed" && <p className="basis-full text-[11.5px] text-amber-500">{t("tb.fillFailed")}</p>}
            </div>
            <WordField ctx={ctx} k="name" label={t("tb.name")} max={BUILDER_LIMITS.name} />
            <WordField ctx={ctx} k="desc" label={t("tb.desc")} placeholder={t("tb.descHint")} max={BUILDER_LIMITS.desc} />
          </section>

          <section className="space-y-3" aria-labelledby="kx-tb-sections">
            <div className="px-1">
              <h3 id="kx-tb-sections" className="text-[13px] font-semibold text-[var(--text-primary)]">{t("tb.sections")}</h3>
              <p className="text-[12px] text-[var(--text-dim)]">{t("tb.sectionsLead")}</p>
            </div>
            {def.sections.map((s, i) => (
              <SectionCard key={s.id} ctx={ctx} s={s} first={i === 0} last={i === def.sections.length - 1}
                onPatch={(fn) => patchSection(s.id, fn)} onDropWords={dropWords}
                onMove={(by) => move(i, by)} onRemove={() => remove(s.id)} />
            ))}
            {tried && problems.has("no_sections") && <p className="px-1 text-[12px] text-amber-500">{t("tb.p.no_sections")}</p>}
            {def.sections.length < BUILDER_LIMITS.sections && (adding ? (
              <div className={`${CARD} p-3`}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {SECTION_KINDS.map((k) => (
                    <button key={k} type="button" onClick={() => addSection(k)}
                      className="kx-hover-glow flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5 text-start transition-colors hover:bg-[var(--bg-surface)]">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#567FB2]/12 text-[#9DBCE0]"><RrIcon name={KIND_ICON[k]} size={13} /></span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-semibold text-[var(--text-primary)]">{t(`tb.k.${k}`)}</span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-dim)]">{t(`tb.kd.${k}`)}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex justify-end"><button type="button" onClick={() => setAdding(false)} className={BTN}>{t("composer.cancel")}</button></div>
              </div>
            ) : (
              <button type="button" onClick={() => setAdding(true)} className={`${BTN} w-full justify-center border-dashed py-5`}><RrIcon name="plus" size={12} />{t("tb.add")}</button>
            ))}
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <section className={`${CARD} space-y-4 p-4`} aria-label={t("tb.settings")}>
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("tb.settings")}</h3>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--text-secondary)]">{t("tb.group")}</span>
              <select value={def.family} onChange={(e) => patch({ family: e.target.value as ReportFamily })} className={FIELD}>
                {REPORT_FAMILIES.map((f) => <option key={f} value={f}>{t(`family.${f}`)}</option>)}
              </select>
            </label>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{t("tb.icon")}</p>
              <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label={t("tb.icon")}>
                {ICON_CHOICES.map((ic) => (
                  <button key={ic} type="button" role="radio" aria-checked={def.icon === ic} aria-label={ic} title={ic} onClick={() => patch({ icon: ic })}
                    className={`grid aspect-square place-items-center rounded-lg border transition-colors ${def.icon === ic ? SEL : `${OFF} border-transparent`}`}>
                    <RrIcon name={ic} size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{t("tb.period")}</p>
              <Seg value={period} label={t("tb.period")} onChange={(v) => patch({ cadence: v === "none" || v === "range" ? null : v, range: v === "range" })}
                options={(["none", "daily", "weekly", "monthly", "quarterly", "halfyear", "yearly", "range"] as const).map((v) => ({ value: v, label: t(`tb.period.${v}`) }))} />
              {def.cadence && <p className="mt-1.5 text-[11px] text-[var(--text-dim)]">{t("tb.periodHint")}</p>}
            </div>
            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{t("tb.to")}</p>
              <Seg value={def.recipients} label={t("tb.to")} onChange={(v) => patch({ recipients: v })}
                options={(["manager", "hr", "manager_hr", "none"] as const).map((v) => ({ value: v, label: t(`tb.to.${v}`) }))} />
            </div>
            <Switch on={def.reviewRequired} label={t("tb.review")} hint={t("tb.reviewHint")} onChange={(v) => patch({ reviewRequired: v })} />
            <Switch on={def.confidential} label={t("composer.confidential")} hint={t("tb.confidentialHint")} onChange={(v) => patch({ confidential: v })} />
            <Switch on={def.urgent} label={t("tb.urgent")} hint={t("tb.urgentHint")} onChange={(v) => patch({ urgent: v })} />
            <Switch on={def.customTitle} label={t("tb.ownTitle")} hint={t("tb.ownTitleHint")} onChange={(v) => patch({ customTitle: v })} />
            <Switch on={def.hrOnly} label={t("tb.hrOnly")} hint={t("tb.hrOnlyHint")} onChange={(v) => patch({ hrOnly: v })} />
            <Switch on={def.teamOnly} label={t("tb.teamOnly")} hint={t("tb.teamOnlyHint")} onChange={(v) => patch({ teamOnly: v })} />
            <Switch on={def.officeOnly} label={t("tb.officeOnly")} hint={t("tb.officeOnlyHint")} onChange={(v) => patch({ officeOnly: v })} />
            <Switch on={def.payrollOnly} label={t("tb.payrollOnly")} hint={t("tb.payrollOnlyHint")} onChange={(v) => patch({ payrollOnly: v })} />
            <Switch on={def.mgmtOnly} label={t("tb.mgmtOnly")} hint={t("tb.mgmtOnlyHint")} onChange={(v) => patch({ mgmtOnly: v })} />
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

/** One word of the type, in the language being written. */
function WordField({ ctx, k, label, placeholder, max, multiline }: { ctx: Ctx; k: string; label: string; placeholder?: string; max: number; multiline?: boolean }) {
  const props = {
    value: ctx.w(k),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => ctx.setW(k, e.target.value),
    maxLength: max,
    /* The language being written sets the direction, not the screen's. */
    dir: ctx.editLang === "ar" ? "rtl" : "ltr",
    lang: ctx.editLang,
    placeholder: ctx.ph(k, placeholder ?? ""),
    "aria-label": label,
    "aria-invalid": ctx.bad(k) || undefined,
    className: FIELD,
  } as const;
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-[var(--text-secondary)]">{label}</span>
      <span className={`block ${ctx.bad(k) ? MISSING : ""}`}>
        {multiline ? <textarea rows={2} {...props} className={`${props.className} resize-none`} /> : <input {...props} />}
      </span>
    </label>
  );
}

function Seg<V extends string>({ value, options, onChange, label }: { value: V; options: Array<{ value: V; label: string }>; onChange: (v: V) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={`h-8 rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${value === o.value ? SEL : OFF}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The Hub's one switch: white knob, the track lit when on. */
function Switch({ on, label, hint, onChange }: { on: boolean; label: string; hint?: string; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-[var(--text-primary)]">{label}</p>
        {hint && <p className="text-[11.5px] leading-snug text-[var(--text-dim)]">{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-emerald-500" : "bg-[var(--bg-surface-subtle)] ring-1 ring-inset ring-[var(--border-subtle)]"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200 ${on ? "start-[22px]" : "start-0.5"}`} />
      </button>
    </div>
  );
}

function SectionCard({ ctx, s, first, last, onPatch, onDropWords, onMove, onRemove }: {
  ctx: Ctx; s: ReportSectionDef; first: boolean; last: boolean;
  onPatch: (fn: (s: ReportSectionDef) => ReportSectionDef) => void; onDropWords: (prefix: string) => void;
  onMove: (by: -1 | 1) => void; onRemove: () => void;
}) {
  const { t } = ctx;
  const sk = `s.${s.id}`;
  return (
    <div className={`${CARD} space-y-3 p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#567FB2]/12 px-2 text-[11.5px] font-semibold text-[#9DBCE0]">
          <RrIcon name={KIND_ICON[s.kind]} size={12} />{t(`tb.k.${s.kind}`)}
        </span>
        <span className="ms-auto flex items-center gap-1">
          <button type="button" disabled={first} onClick={() => onMove(-1)} aria-label={t("tb.up")} title={t("tb.up")} className={ICON_BTN}><span className="inline-block rotate-90"><RrIcon name="arrow-left" size={11} /></span></button>
          <button type="button" disabled={last} onClick={() => onMove(1)} aria-label={t("tb.down")} title={t("tb.down")} className={ICON_BTN}><span className="inline-block -rotate-90"><RrIcon name="arrow-left" size={11} /></span></button>
          <button type="button" onClick={onRemove} aria-label={t("tb.remove")} title={t("tb.remove")} className={`${ICON_BTN} hover:text-red-400`}><RrIcon name="trash" size={11} /></button>
        </span>
      </div>
      <WordField ctx={ctx} k={sk} label={t("tb.label")} max={BUILDER_LIMITS.label} />
      {(s.kind === "text" || s.kind === "list") && <WordField ctx={ctx} k={`${sk}.hint`} label={t("tb.sHint")} max={BUILDER_LIMITS.hint} />}

      {(s.kind === "checklist" || s.kind === "score") && (
        <Items ctx={ctx} label={s.kind === "score" ? t("tb.criteria") : t("tb.points")} addLabel={s.kind === "score" ? t("tb.addCriterion") : t("tb.addPoint")}
          ids={(s.points ?? []).map((p) => p.id)} wordKey={(id) => `${sk}.i.${id}`} max={BUILDER_LIMITS.points} prefix="p" bad={ctx.bad(`points:${s.id}`)}
          extra={s.kind === "score" ? (id) => {
            const pt = s.points?.find((p) => p.id === id);
            return (
              <input type="number" min={1} max={100} inputMode="numeric" aria-label={t("tb.weight")} title={t("tb.weight")} placeholder={t("tb.weight")}
                value={pt?.weight ?? ""} onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  onPatch((x) => ({ ...x, points: (x.points ?? []).map((p) => (p.id === id ? (n > 1 && n <= 100 ? { id, weight: n } : { id }) : p)) }));
                }} className={`${FIELD_INLINE} w-20 shrink-0 tabular-nums`} />
            );
          } : undefined}
          onAdd={(id) => onPatch((x) => ({ ...x, points: [...(x.points ?? []), { id }] }))}
          onRemove={(id) => { onPatch((x) => ({ ...x, points: (x.points ?? []).filter((p) => p.id !== id) })); onDropWords(`${sk}.i.${id}`); }} />
      )}

      {s.kind === "table" && (
        <>
          <Items ctx={ctx} label={t("tb.columns")} addLabel={t("tb.addColumn")} ids={(s.columns ?? []).map((c) => c.id)} wordKey={(id) => `${sk}.c.${id}`}
            max={BUILDER_LIMITS.columns} prefix="c" bad={ctx.bad(`columns:${s.id}`)}
            extra={(id) => (
              <select aria-label={t("tb.columns")} value={s.columns?.find((c) => c.id === id)?.type ?? "text"}
                onChange={(e) => onPatch((x) => ({ ...x, columns: (x.columns ?? []).map((c) => (c.id === id ? { id, type: e.target.value as ReportColumnType } : c)) }))}
                className={`${FIELD_INLINE} w-28 shrink-0`}>
                {COLUMN_TYPES.map((ct) => <option key={ct} value={ct}>{t(`tb.col.${ct}`)}</option>)}
              </select>
            )}
            onAdd={(id) => onPatch((x) => ({ ...x, columns: [...(x.columns ?? []), { id, type: "text" }] }))}
            onRemove={(id) => { onPatch((x) => ({ ...x, columns: (x.columns ?? []).filter((c) => c.id !== id), summaryOf: x.summaryOf?.filter((c) => c !== id) })); onDropWords(`${sk}.c.${id}`); }} />
          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{t("tb.figures")}</p>
            <Seg value={s.summary ?? "total"} label={t("tb.figures")} onChange={(v) => onPatch((x) => ({ ...x, summary: v }))}
              options={(["total", "lowest", "none"] as const).map((v) => ({ value: v, label: t(`tb.fig.${v}`) }))} />
          </div>
        </>
      )}

      {s.kind === "choice" && (
        <Items ctx={ctx} label={t("tb.options")} addLabel={t("tb.addOption")} ids={s.options ?? []} wordKey={(id) => `${sk}.o.${id}`}
          max={BUILDER_LIMITS.options} prefix="o" bad={ctx.bad(`options:${s.id}`)}
          onAdd={(id) => onPatch((x) => ({ ...x, options: [...(x.options ?? []), id] }))}
          onRemove={(id) => { onPatch((x) => ({ ...x, options: (x.options ?? []).filter((o) => o !== id) })); onDropWords(`${sk}.o.${id}`); }} />
      )}

      {s.kind === "links" && (
        <div>
          <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{t("tb.linkTypes")}</p>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_LINK_TYPES.map((lt: ReportLinkType) => {
              const on = (s.linkTypes ?? REPORT_LINK_TYPES).includes(lt);
              return (
                <button key={lt} type="button" role="checkbox" aria-checked={on}
                  onClick={() => onPatch((x) => {
                    const cur = x.linkTypes ?? [...REPORT_LINK_TYPES];
                    const next = on ? cur.filter((y) => y !== lt) : REPORT_LINK_TYPES.filter((y) => y === lt || cur.includes(y));
                    return next.length ? { ...x, linkTypes: next } : x;
                  })}
                  className={`h-7 rounded-lg border px-2.5 text-[11.5px] font-medium transition-colors ${on ? SEL : OFF}`}>
                  {t(`blk.link.${lt}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {s.kind === "data" && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-[var(--text-secondary)]">{t("tb.source")}</span>
            <span className={`block ${ctx.bad(`source:${s.id}`) ? MISSING : ""}`}>
              <select value={s.source ?? ""} onChange={(e) => onPatch((x) => ({ ...x, source: (e.target.value || undefined) as ReportDataSource | undefined }))}
                aria-invalid={ctx.bad(`source:${s.id}`) || undefined} className={FIELD}>
                <option value="">{t("tb.pickSource")}</option>
                {/* By the app each comes from (5C: HR, Projects, Inventory and Finance joined). */}
                {SOURCE_GROUPS.map((g) => (
                  <optgroup key={g.id} label={t(`family.${g.id}`)}>
                    {g.sources.map((src) => <option key={src} value={src}>{t(`tb.src.${src}`)}</option>)}
                  </optgroup>
                ))}
              </select>
            </span>
          </label>
          <Switch on={!!s.notes} label={t("tb.notes")} onChange={(v) => onPatch((x) => { const next = { ...x }; if (v) next.notes = true; else delete next.notes; return next; })} />
        </div>
      )}

      {s.kind === "signature" && <p className="text-[12px] text-[var(--text-dim)]">{t("tb.signatureNote")}</p>}

      {s.kind !== "data" && (
        <Switch on={!!s.required} label={t("composer.required")} onChange={(v) => onPatch((x) => ({ ...x, required: v }))} />
      )}
    </div>
  );
}

/** The points, criteria, columns or answers of a block: each named in the
 *  language being written, removed one by one, added up to the limit. */
function Items({ ctx, label, addLabel, ids, wordKey, max, prefix, bad, extra, onAdd, onRemove }: {
  ctx: Ctx; label: string; addLabel: string; ids: string[]; wordKey: (id: string) => string; max: number; prefix: string; bad: boolean;
  extra?: (id: string) => React.ReactNode; onAdd: (id: string) => void; onRemove: (id: string) => void;
}) {
  const { t } = ctx;
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-semibold text-[var(--text-secondary)]">{label}</p>
      <ul className={`space-y-1.5 ${bad ? `${MISSING} p-1` : ""}`}>
        {ids.map((id, n) => (
          <li key={id} className="flex items-center gap-1.5">
            <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-[var(--text-faint)]">{n + 1}</span>
            <span className={`min-w-0 flex-1 ${ctx.bad(wordKey(id)) ? MISSING : ""}`}>
              <input value={ctx.w(wordKey(id))} onChange={(e) => ctx.setW(wordKey(id), e.target.value)} maxLength={BUILDER_LIMITS.label}
                dir={ctx.editLang === "ar" ? "rtl" : "ltr"} lang={ctx.editLang} placeholder={ctx.ph(wordKey(id), "")} aria-label={`${label} ${n + 1}`}
                aria-invalid={ctx.bad(wordKey(id)) || undefined} className={FIELD} />
            </span>
            {extra?.(id)}
            <button type="button" onClick={() => onRemove(id)} aria-label={t("tb.remove")} title={t("tb.remove")} className={`${ICON_BTN} hover:text-red-400`}><RrIcon name="cross" size={10} /></button>
          </li>
        ))}
      </ul>
      {ids.length < max && (
        <button type="button" onClick={() => onAdd(nextId(ids, prefix))} className={`${BTN} mt-2`}><RrIcon name="plus" size={11} />{addLabel}</button>
      )}
    </div>
  );
}
