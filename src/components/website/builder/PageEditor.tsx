"use client";

/* ---------------------------------------------------------------------------
   builder/PageEditor — one page of the public site in the Page Builder
   (Phase 3 step 3, owner 30/09/2026): its sections on one side, the chosen
   section's form on the other, in the language picked (English, العربية,
   中文 — a missing word shows in English on the site).

   · Every change is saved as the DRAFT a moment later; the site does not
     change until Publish. A save refused because someone else saved in
     between (409) stops saving and asks to reload — nobody's work is
     overwritten silently.
   · Publish (super admins and «Website Publish»): the pending save goes
     first, then the page goes live as the next version; what is missing is
     listed per section when it is not ready.
   · Versions: every published version, each can be put back in the draft.
   · Preview: the draft on the real site, through a 10-minute signed link.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { websiteBuilderT } from "@/lib/translations/website-builder";
import {
  LIMITS, missingIn, newSection, PAGE_LANGS, SECTION_TYPES,
  type PageDoc, type PageLang, type PageSection, type PublishProblem, type SectionType,
} from "@/lib/website/page-doc";
import SectionForm from "./SectionForm";
import { smallBtn, TextField } from "./fields";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ArrowUpIcon from "@/components/icons/ui/ArrowUpIcon";
import ArrowDownIcon from "@/components/icons/ui/ArrowDownIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";

interface LoadedPage {
  slug: string; name: string; title: string | null; draft: PageDoc; changed: boolean;
  version: number; publishedAt: string | null; draftUpdatedAt: string | null; legacySections: number;
}
type SaveState = "saved" | "saving" | "error" | "conflict";
const SEO = "__seo";
const LANG_LABEL: Record<PageLang, string> = { en: "English", ar: "العربية", zh: "中文" };

function dmyTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function PageEditor({ slug, onBack }: { slug: string; onBack: () => void }) {
  const { t } = useTranslation(websiteBuilderT);
  const [page, setPage] = useState<LoadedPage | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [doc, setDoc] = useState<PageDoc | null>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [canPreview, setCanPreview] = useState(false);
  const [lang, setLang] = useState<PageLang>("en");
  const [selected, setSelected] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("saved");
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [problems, setProblems] = useState<PublishProblem[] | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ version: number; publishedAt: string; publishedBy: string | null }> | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  /* The latest draft and the save bookkeeping live in refs: the timer and
     the save read them, never a stale render. */
  const docRef = useRef<PageDoc | null>(null);
  const expectedRef = useRef<string | null>(null);
  const editsRef = useRef(0);      // bumped on every edit
  const savedEditsRef = useRef(0); // the edit count the last good save covered
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const conflictRef = useRef(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await fetch(`/api/website/pages/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { page: LoadedPage; canPublish: boolean; canPreview: boolean };
      setPage(j.page);
      setDoc(j.page.draft);
      docRef.current = j.page.draft;
      expectedRef.current = j.page.draftUpdatedAt;
      editsRef.current = 0;
      savedEditsRef.current = 0;
      conflictRef.current = false;
      setSave("saved");
      setCanPublish(j.canPublish);
      setCanPreview(j.canPreview);
      setSelected((cur) => (cur && (cur === SEO || j.page.draft.sections.some((s) => s.id === cur)) ? cur : null));
    } catch {
      setLoadFailed(true);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  /** Save the draft now if it has unsaved edits. true when all is saved. */
  const saveNow = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (conflictRef.current) return false;
    if (savingRef.current) await savingRef.current;
    if (editsRef.current === savedEditsRef.current) return true;
    const edits = editsRef.current;
    const run = (async () => {
      setSave("saving");
      try {
        const res = await fetch(`/api/website/pages/${encodeURIComponent(slug)}/draft`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft: docRef.current, expected: expectedRef.current }),
        });
        if (res.status === 409) { conflictRef.current = true; setSave("conflict"); return false; }
        if (!res.ok) throw new Error(String(res.status));
        const j = (await res.json()) as { draftUpdatedAt: string };
        expectedRef.current = j.draftUpdatedAt;
        savedEditsRef.current = edits;
        if (editsRef.current === edits) setSave("saved");
        return true;
      } catch {
        setSave("error");
        /* Try again shortly; the edits stay in memory until then. */
        timerRef.current = setTimeout(() => { void saveNow(); }, 5000);
        return false;
      }
    })();
    savingRef.current = run;
    const ok = await run;
    savingRef.current = null;
    if (ok && editsRef.current !== savedEditsRef.current) return saveNow();
    return ok;
  }, [slug]);

  /* Leaving with an edit not yet saved: save it on the way out, and let the
     browser warn before the window closes. */
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (editsRef.current !== savedEditsRef.current && !conflictRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      if (editsRef.current !== savedEditsRef.current && !conflictRef.current) void saveNow();
      else if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [saveNow]);

  const edit = useCallback((next: PageDoc) => {
    if (conflictRef.current) return;
    docRef.current = next;
    setDoc(next);
    editsRef.current += 1;
    setProblems(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void saveNow(); }, 1200);
  }, [saveNow]);

  const setSection = (s: PageSection) => doc && edit({ ...doc, sections: doc.sections.map((x) => (x.id === s.id ? s : x)) });
  const moveSection = (id: string, by: -1 | 1) => {
    if (!doc) return;
    const i = doc.sections.findIndex((s) => s.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= doc.sections.length) return;
    const list = doc.sections.slice();
    [list[i], list[j]] = [list[j], list[i]];
    edit({ ...doc, sections: list });
  };
  const addSection = (type: SectionType) => {
    if (!doc || doc.sections.length >= LIMITS.sections) return;
    const s = newSection(type);
    edit({ ...doc, sections: [...doc.sections, s] });
    setSelected(s.id);
    setAdding(false);
  };

  const back = async () => { await saveNow(); onBack(); };

  const publish = async () => {
    setConfirmPublish(false);
    setPublishing(true);
    setProblems(null);
    try {
      if (!(await saveNow())) return;
      const res = await fetch(`/api/website/pages/${encodeURIComponent(slug)}/publish`, { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { error?: string; problems?: PublishProblem[]; version?: number };
      if (res.status === 400 && j.problems) { setProblems(j.problems); return; }
      if (!res.ok) { setFlash(j.error ?? "—"); return; }
      setFlash(t("published", "Published — live within seconds"));
      setVersions(null);
      await load();
    } finally {
      setPublishing(false);
    }
  };

  const openVersions = async () => {
    setShowVersions((v) => !v);
    if (versions) return;
    const res = await fetch(`/api/website/pages/${encodeURIComponent(slug)}/versions`, { cache: "no-store" }).catch(() => null);
    const j = res && res.ok ? ((await res.json()) as { versions: typeof versions }) : null;
    setVersions(j?.versions ?? []);
  };

  const restore = async (version: number) => {
    if (!(await saveNow())) return;
    const res = await fetch(`/api/website/pages/${encodeURIComponent(slug)}/versions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version, expected: expectedRef.current }),
    });
    if (res.status === 409) { conflictRef.current = true; setSave("conflict"); return; }
    if (res.ok) { setShowVersions(false); await load(); }
  };

  const preview = async () => {
    if (!(await saveNow())) return;
    const res = await fetch(`/api/website/pages/${encodeURIComponent(slug)}/preview?lang=${lang}`, { cache: "no-store" }).catch(() => null);
    const j = res && res.ok ? ((await res.json()) as { url?: string }) : null;
    if (j?.url) window.open(j.url, "_blank", "noopener,noreferrer");
    else setFlash(t("previewUnavailable", "Preview works once the website bridge is configured."));
  };

  useEffect(() => {
    if (!flash) return;
    const h = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(h);
  }, [flash]);

  if (loadFailed) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-sm text-[var(--text-secondary)]">{t("pageLoadFailed", "The page could not be loaded.")}</p>
        <button className={smallBtn} onClick={() => void load()}>{t("reload", "Reload")}</button>
      </div>
    );
  }
  if (!page || !doc) {
    return <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--bg-secondary)]" />)}</div>;
  }

  const current = selected === SEO ? null : doc.sections.find((s) => s.id === selected) ?? null;
  const typeLabel = (type: SectionType) => t(`type.${type}`, type);
  const sectionTitle = (s: PageSection) => {
    const title = (s as { title?: { en: string } }).title?.en;
    return title ? title : typeLabel(s.type);
  };
  const statusText = save === "saving" ? t("saving", "Saving…") : save === "error" ? t("saveFailed", "Not saved yet — trying again") : save === "conflict" ? "" : t("saved", "Saved");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button className={smallBtn} onClick={() => void back()}><ArrowLeftIcon size={13} />{t("back", "Pages")}</button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{page.name} <span className="font-normal text-[var(--text-dim)]">/{page.slug === "home" ? "" : page.slug}</span></p>
          <p className="text-[11px] text-[var(--text-dim)]" aria-live="polite">
            {page.version > 0 ? t("live", "Live · v{n}").replace("{n}", String(page.version)) : t("notLive", "Not published yet")}
            {statusText ? ` · ${statusText}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] p-0.5" role="radiogroup" aria-label={t("language", "Language")}>
          {PAGE_LANGS.map((l) => (
            <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)}
              className={`rounded-md px-2.5 py-1 text-[12px] ${lang === l ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{LANG_LABEL[l]}</button>
          ))}
        </div>
        <button className={smallBtn} onClick={() => void openVersions()} aria-expanded={showVersions}><HistoryIcon size={13} />{t("versions", "Versions")}</button>
        <button className={smallBtn} onClick={() => void preview()} disabled={!canPreview} title={canPreview ? undefined : t("previewUnavailable", "Preview works once the website bridge is configured.")}><EyeIcon size={13} />{t("preview", "Preview")}</button>
        {canPublish ? (
          <button onClick={() => setConfirmPublish(true)} disabled={publishing || save === "conflict"}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-40">
            <GlobeIcon size={13} />{publishing ? t("publishing", "Publishing…") : t("publish", "Publish")}
          </button>
        ) : null}
      </div>

      {save === "conflict" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-3 text-[13px]">
          <span>{t("conflict", "Someone else changed this page. Reload to see their changes.")}</span>
          <button className={smallBtn} onClick={() => void load()}>{t("reload", "Reload")}</button>
        </div>
      ) : null}
      {page.version === 0 ? (
        <p className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2.5 text-[12px] text-[var(--text-muted)]">
          {page.legacySections > 0 ? t("legacyNote", "Until you publish it here, this page shows {n} sections from the old editor.").replace("{n}", String(page.legacySections)) : t("builtInNote", "Until you publish it here, this page shows its built-in content.")}
        </p>
      ) : null}
      {!canPublish ? <p className="text-[12px] text-[var(--text-dim)]">{t("cannotPublish", "Only the super admins and whoever is given «Website Publish» can publish. Your changes are saved as a draft.")}</p> : null}
      {problems && problems.length > 0 ? (
        <div className="rounded-xl border border-[#FF3333]/30 bg-[#FF3333]/5 px-4 py-3 text-[13px]">
          <p className="font-medium">{t("notReady", "Not ready to publish yet:")}</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {problems.map((p, i) => (
              <li key={i}>
                {p.section === null ? t(`problem.${p.key}`, p.key) : (
                  <button className="text-start underline-offset-2 hover:underline" onClick={() => setSelected(doc.sections[p.section!]?.id ?? null)}>
                    {sectionTitle(doc.sections[p.section])}: {t(`problem.${p.key}`, p.key)}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {flash ? <p className="rounded-xl border border-[var(--border-subtle)] px-4 py-2.5 text-[13px]" role="status">{flash}</p> : null}

      {showVersions ? (
        <div className="rounded-xl border border-[var(--border-subtle)] p-3">
          {versions === null ? <div className="h-10 animate-pulse rounded-lg bg-[var(--bg-secondary)]" /> : versions.length === 0 ? (
            <p className="text-[13px] text-[var(--text-muted)]">{t("noVersions", "No version published yet.")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {versions.map((v) => (
                <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span>v{v.version} · {dmyTime(v.publishedAt)}{v.publishedBy ? ` · ${t("by", "by")} ${v.publishedBy}` : ""}</span>
                  <button className={smallBtn} onClick={() => void restore(v.version)}>{t("restore", "Put back in the draft")}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
        {/* Sections */}
        <div className={`flex flex-col gap-2 ${selected ? "hidden md:flex" : "flex"}`}>
          {doc.sections.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-[13px] text-[var(--text-muted)]">{t("emptyPage", "This page has no sections yet. Add the first one.")}</p> : null}
          {doc.sections.map((s, i) => (
            <div key={s.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${selected === s.id ? "border-[var(--border-focus)] bg-[var(--bg-surface-hover)]" : "border-[var(--border-subtle)]"}`}>
              <button className="min-w-0 flex-1 text-start" onClick={() => setSelected(s.id)}>
                <span className="block truncate text-[13px] font-medium">{sectionTitle(s)}</span>
                <span className="block truncate text-[11px] text-[var(--text-dim)]">
                  {typeLabel(s.type)}{s.hidden ? ` · ${t("hidden", "Hidden")}` : ""}
                  {missingIn(s, "ar") || missingIn(s, "zh") ? <span title={t("missing", "Arabic or Chinese still to write — the website shows English there")}> · AR/ZH ○</span> : null}
                </span>
              </button>
              <button className={smallBtn} disabled={i === 0} onClick={() => moveSection(s.id, -1)} aria-label={t("moveUp", "Move up")}><ArrowUpIcon size={12} /></button>
              <button className={smallBtn} disabled={i === doc.sections.length - 1} onClick={() => moveSection(s.id, 1)} aria-label={t("moveDown", "Move down")}><ArrowDownIcon size={12} /></button>
              <button className={smallBtn} onClick={() => setSection({ ...s, hidden: !s.hidden })} aria-label={s.hidden ? t("show", "Show on the website") : t("hide", "Hide on the website")}>{s.hidden ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}</button>
              <button className={smallBtn} onClick={() => setConfirmDelete(s.id)} aria-label={t("delete", "Delete")}><TrashIcon size={12} /></button>
            </div>
          ))}
          <div className="relative">
            <button className={smallBtn} onClick={() => setAdding((a) => !a)} disabled={doc.sections.length >= LIMITS.sections} aria-expanded={adding}><PlusIcon size={12} />{t("addSection", "Add section")}</button>
            {adding ? (
              <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
                {SECTION_TYPES.map((type) => (
                  <button key={type} className="rounded-lg px-2.5 py-2 text-start text-[12px] hover:bg-[var(--bg-surface-hover)]" onClick={() => addSection(type)}>{typeLabel(type)}</button>
                ))}
              </div>
            ) : null}
          </div>
          <button className={`mt-2 rounded-xl border px-3 py-2 text-start text-[12px] ${selected === SEO ? "border-[var(--border-focus)] bg-[var(--bg-surface-hover)]" : "border-[var(--border-subtle)] text-[var(--text-muted)]"}`} onClick={() => setSelected(SEO)}>
            {t("f.seo", "On Google")}
          </button>
        </div>

        {/* The chosen section */}
        <div className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] p-4`}>
          {selected ? <button className={`${smallBtn} self-start md:hidden`} onClick={() => setSelected(null)}><ArrowLeftIcon size={12} />{t("sections", "Sections")}</button> : null}
          {selected === SEO ? (
            <div className="flex flex-col gap-4">
              <TextField label={t("f.seoTitle", "Page title on Google")} value={doc.seo.title} lang={lang} max={LIMITS.seoTitle} onChange={(v) => edit({ ...doc, seo: { ...doc.seo, title: v } })} />
              <TextField label={t("f.seoDescription", "Description on Google")} value={doc.seo.description} lang={lang} max={LIMITS.seoDescription} multiline rows={3} onChange={(v) => edit({ ...doc, seo: { ...doc.seo, description: v } })} />
            </div>
          ) : current ? (
            <>
              <p className="text-[12px] font-semibold text-[var(--text-muted)]">{typeLabel(current.type)}</p>
              <SectionForm section={current} lang={lang} onChange={setSection} />
            </>
          ) : (
            <p className="py-10 text-center text-[13px] text-[var(--text-muted)]">{t("chooseSection", "Choose a section to edit it.")}</p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={t("deleteConfirm", "Delete this section?")}
        description={t("deleteBody", "It leaves the draft now; the website keeps it until you publish.")}
        confirmLabel={t("delete", "Delete")}
        cancelLabel={t("cancel", "Cancel")}
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (doc && confirmDelete) edit({ ...doc, sections: doc.sections.filter((s) => s.id !== confirmDelete) });
          if (selected === confirmDelete) setSelected(null);
          setConfirmDelete(null);
        }}
      />
      <ConfirmDialog
        open={confirmPublish}
        title={t("publishConfirmTitle", "Publish this page?")}
        description={t("publishConfirmBody", "It replaces what the website shows now, within seconds. The version it replaces stays in Versions.")}
        confirmLabel={t("publish", "Publish")}
        cancelLabel={t("cancel", "Cancel")}
        busy={publishing}
        onCancel={() => setConfirmPublish(false)}
        onConfirm={() => void publish()}
      />
    </div>
  );
}
