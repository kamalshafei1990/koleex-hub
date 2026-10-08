"use client";

/* ---------------------------------------------------------------------------
   WebsiteCatalogsPanel — Koleex's own catalogs for the public site (owner,
   30/09/2026: "just Koleex catalogs only — don't show any supplier
   catalog"). They live apart from the Catalogs app: a supplier catalog is
   never in this list, so no switch can put one on the site.
   Add: pick the PDF (it goes straight to storage through a signed link —
   up to 100 MB), a cover photo, the title and description in English,
   Arabic and Chinese, the year. Each catalog can be hidden from the site,
   edited or deleted.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { websiteBuilderT } from "@/lib/translations/website-builder";
import { emptyText, PAGE_LANGS, type I18nText, type PageImage, type PageLang } from "@/lib/website/page-doc";
import { fieldCls, PhotoField, smallBtn, TextField } from "@/components/website/builder/fields";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";

interface Catalog { id: string; title: I18nText; description: I18nText; fileUrl: string; fileSize: number | null; coverUrl: string | null; year: number | null; sort: number; visible: boolean }
interface Draft { id: string | null; title: I18nText; description: I18nText; year: string; cover: PageImage | null; path: string | null; fileName: string | null }
const LANG_LABEL: Record<PageLang, string> = { en: "English", ar: "العربية", zh: "中文" };
const mb = (n: number | null) => (n ? `${(n / 1048576).toFixed(1)} MB` : "");

export default function WebsiteCatalogsPanel() {
  const { t } = useTranslation(websiteBuilderT);
  const [list, setList] = useState<Catalog[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lang, setLang] = useState<PageLang>("en");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Catalog | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await fetch("/api/website/catalogs", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setList(((await res.json()) as { catalogs: Catalog[] }).catalogs);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const upload = async (file: File) => {
    if (!draft) return;
    setError(null);
    if (file.type && file.type !== "application/pdf") { setError(t("cat.pdfOnly", "Only a PDF file.")); return; }
    setUploading(true);
    try {
      const linkRes = await fetch("/api/website/catalogs/upload-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size: file.size }) });
      const link = (await linkRes.json().catch(() => ({}))) as { path?: string; signedUrl?: string; error?: string };
      if (!linkRes.ok || !link.path || !link.signedUrl) throw new Error(link.error || t("cat.uploadFailed", "The PDF could not be uploaded."));
      /* The signed link is absolute in newer storage clients, relative in older ones. */
      const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
      const target = /^https?:\/\//i.test(link.signedUrl) ? link.signedUrl : `${base}/storage/v1${link.signedUrl.startsWith("/") ? "" : "/"}${link.signedUrl}`;
      const put = await fetch(target, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file });
      if (!put.ok) throw new Error(t("cat.uploadFailed", "The PDF could not be uploaded."));
      setDraft((d) => (d ? { ...d, path: link.path!, fileName: file.name } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("cat.uploadFailed", "The PDF could not be uploaded."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const body = { title: draft.title, description: draft.description, year: draft.year ? Number(draft.year) : null, coverUrl: draft.cover?.url ?? null, ...(draft.id ? {} : { path: draft.path }) };
      const res = await fetch(draft.id ? `/api/website/catalogs/${draft.id}` : "/api/website/catalogs", {
        method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setError(j.error ?? "—"); return; }
      setDraft(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: Catalog) => {
    setList((l) => (l ? l.map((x) => (x.id === c.id ? { ...x, visible: !c.visible } : x)) : l));
    const res = await fetch(`/api/website/catalogs/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible: !c.visible }) });
    if (!res.ok) await load();
  };

  const remove = async () => {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    const res = await fetch(`/api/website/catalogs/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  const startNew = () => { setError(null); setDraft({ id: null, title: emptyText(), description: emptyText(), year: String(new Date().getFullYear()), cover: null, path: null, fileName: null }); };
  const startEdit = (c: Catalog) => { setError(null); setDraft({ id: c.id, title: c.title, description: c.description, year: c.year ? String(c.year) : "", cover: c.coverUrl ? { url: c.coverUrl, alt: emptyText() } : null, path: null, fileName: null }); };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t("cat.title", "Koleex catalogs")}</h2>
          <p className="text-[12px] text-[var(--text-dim)]">{t("cat.note", "Only Koleex's own catalogs — suppliers' catalogs never appear on the website.")}</p>
        </div>
        {!draft ? <button className={smallBtn} onClick={startNew}><PlusIcon size={12} />{t("cat.add", "Add catalog")}</button> : null}
      </div>

      {draft ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] p-4">
          {!draft.id ? (
            <div className="flex flex-wrap items-center gap-3">
              <button className={smallBtn} disabled={uploading} onClick={() => fileRef.current?.click()}><UploadIcon size={13} />{uploading ? t("f.uploading", "Uploading…") : draft.path ? t("f.replace", "Replace") : t("cat.pickPdf", "Choose the PDF")}</button>
              <span className="text-[12px] text-[var(--text-muted)]">{draft.fileName ?? t("cat.pdfRule", "PDF, up to 100 MB")}</span>
              <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
            </div>
          ) : null}
          <div className="flex items-center gap-1 self-start rounded-lg border border-[var(--border-subtle)] p-0.5" role="radiogroup" aria-label={t("language", "Language")}>
            {PAGE_LANGS.map((l) => (
              <button key={l} role="radio" aria-checked={lang === l} onClick={() => setLang(l)} className={`rounded-md px-2.5 py-1 text-[12px] ${lang === l ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{LANG_LABEL[l]}</button>
            ))}
          </div>
          <TextField label={t("f.title", "Title")} value={draft.title} lang={lang} max={160} onChange={(v) => setDraft({ ...draft, title: v })} />
          <TextField label={t("cat.description", "Description")} value={draft.description} lang={lang} max={600} multiline rows={3} onChange={(v) => setDraft({ ...draft, description: v })} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[var(--text-muted)]">{t("cat.year", "Year")}</span>
            <input dir="ltr" inputMode="numeric" maxLength={4} value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value.replace(/\D/g, "") })} className={`${fieldCls} w-28`} />
          </label>
          <PhotoField label={t("cat.cover", "Cover")} value={draft.cover} lang={lang} onChange={(v) => setDraft({ ...draft, cover: v })} />
          {error ? <p className="text-[12px] text-[#FF3333]">{error}</p> : null}
          <div className="flex gap-2">
            <button className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-40" disabled={saving || uploading || !draft.title.en || (!draft.id && !draft.path)} onClick={() => void save()}>{t("cat.save", "Save")}</button>
            <button className={smallBtn} onClick={() => setDraft(null)}>{t("cancel", "Cancel")}</button>
          </div>
        </div>
      ) : null}

      {failed ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border-subtle)] p-4">
          <p className="text-sm text-[var(--text-muted)]">{t("cat.loadFailed", "The catalogs could not be loaded.")}</p>
          <button className={smallBtn} onClick={() => void load()}>{t("reload", "Reload")}</button>
        </div>
      ) : list === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--bg-secondary)]" />)}</div>
      ) : list.length === 0 && !draft ? (
        <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">{t("cat.empty", "No catalog yet. Add Koleex's first catalog.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] p-3">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--bg-surface-subtle)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.coverUrl ? <img src={c.coverUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.title.en}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{[c.year, mb(c.fileSize), c.visible ? t("cat.onSite", "On the website") : t("hidden", "Hidden")].filter(Boolean).join(" · ")}</p>
              </div>
              <button role="switch" aria-checked={c.visible} aria-label={t("cat.onSite", "On the website")} onClick={() => void toggle(c)}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${c.visible ? "bg-[#10B981]" : "bg-[var(--bg-surface-hover)]"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${c.visible ? "start-[18px]" : "start-0.5"}`} />
              </button>
              <a className={smallBtn} href={c.fileUrl} target="_blank" rel="noopener noreferrer">PDF</a>
              <button className={smallBtn} onClick={() => startEdit(c)} aria-label={t("open", "Edit")}><PencilIcon size={12} /></button>
              <button className={smallBtn} onClick={() => setDeleting(c)} aria-label={t("delete", "Delete")}><TrashIcon size={12} /></button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("cat.deleteTitle", "Delete this catalog?")}
        description={t("cat.deleteBody", "It leaves the website and its PDF is deleted.")}
        confirmLabel={t("delete", "Delete")}
        cancelLabel={t("cancel", "Cancel")}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
