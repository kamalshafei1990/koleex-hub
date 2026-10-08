"use client";

/* ---------------------------------------------------------------------------
   builder/fields — the Page Builder's inputs. Every text is written in the
   language the editor has chosen (English, العربية, 中文); Arabic is typed
   right-to-left, and the English stands as the placeholder while
   translating. Photos go up through /api/website/media (the company's own
   only, 4 MB).
   --------------------------------------------------------------------------- */

import { useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { websiteBuilderT } from "@/lib/translations/website-builder";
import type { I18nText, PageButton, PageImage, PageLang } from "@/lib/website/page-doc";
import { emptyText } from "@/lib/website/page-doc";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";

export const fieldCls =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] leading-5 text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-focus)] focus:outline-none";
export const labelCls = "text-[12px] font-medium text-[var(--text-muted)]";
export const smallBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelCls}>{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-[var(--text-dim)]">{hint}</span> : null}
    </label>
  );
}

/** One text in the chosen language. */
export function TextField({ label, hint, value, lang, onChange, multiline = false, rows = 3, max }: {
  label: string; hint?: string; value: I18nText; lang: PageLang; onChange: (v: I18nText) => void; multiline?: boolean; rows?: number; max: number;
}) {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const placeholder = lang === "en" ? "" : value.en;
  const set = (s: string) => onChange({ ...value, [lang]: s });
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea dir={dir} rows={rows} maxLength={max} value={value[lang]} placeholder={placeholder} onChange={(e) => set(e.target.value)} className={`${fieldCls} resize-y`} />
      ) : (
        <input dir={dir} maxLength={max} value={value[lang]} placeholder={placeholder} onChange={(e) => set(e.target.value)} className={fieldCls} />
      )}
    </Field>
  );
}

export function ChoiceField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] ${value === o.value ? "border-[var(--border-focus)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-color)]"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

/** A photo: upload, replace, remove, and what it shows (in the chosen language). */
export function PhotoField({ label, value, lang, onChange }: { label: string; value: PageImage | null; lang: PageLang; onChange: (v: PageImage | null) => void }) {
  const { t } = useTranslation(websiteBuilderT);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const upload = async (file: File) => {
    setBusy(true);
    setFailed(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/website/media", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error || t("f.uploadFailed", "The photo could not be uploaded."));
      onChange({ url: j.url, alt: value?.alt ?? emptyText() });
    } catch (e) {
      setFailed(e instanceof Error ? e.message : t("f.uploadFailed", "The photo could not be uploaded."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <span className={labelCls}>{label}</span>
      <div className="flex items-start gap-3">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value.url} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={smallBtn} disabled={busy} onClick={() => fileRef.current?.click()}>
              <UploadIcon size={13} />{busy ? t("f.uploading", "Uploading…") : value ? t("f.replace", "Replace") : t("f.upload", "Upload photo")}
            </button>
            {value ? <button type="button" className={smallBtn} onClick={() => onChange(null)}><TrashIcon size={13} />{t("f.remove", "Remove")}</button> : null}
          </div>
          <span className="text-[11px] text-[var(--text-dim)]">{t("f.photoRule", "Only the company's own photos — JPEG, PNG, WebP or AVIF, up to 4 MB.")}</span>
          {failed ? <span className="text-[11px] text-[#FF3333]">{failed}</span> : null}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      </div>
      {value ? <TextField label={t("f.alt", "What the photo shows (for search engines and screen readers)")} value={value.alt} lang={lang} max={200} onChange={(alt) => onChange({ ...value, alt })} /> : null}
    </div>
  );
}

/** A button: label (chosen language) and link; "Add a button" when there is none. */
export function ButtonField({ label, value, lang, onChange }: { label: string; value: PageButton | null; lang: PageLang; onChange: (v: PageButton | null) => void }) {
  const { t } = useTranslation(websiteBuilderT);
  if (!value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>{label}</span>
        <div><button type="button" className={smallBtn} onClick={() => onChange({ label: emptyText(), href: "" })}>{t("f.addButton", "Add a button")}</button></div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={labelCls}>{label}</span>
        <button type="button" className={smallBtn} onClick={() => onChange(null)}><TrashIcon size={13} />{t("f.remove", "Remove")}</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <TextField label={t("f.label", "Label")} value={value.label} lang={lang} max={160} onChange={(l) => onChange({ ...value, label: l })} />
        <Field label={t("f.link", "Link (/page or https://…)")}>
          <input dir="ltr" maxLength={500} value={value.href} placeholder="/contact" onChange={(e) => onChange({ ...value, href: e.target.value })} className={fieldCls} />
        </Field>
      </div>
    </div>
  );
}
