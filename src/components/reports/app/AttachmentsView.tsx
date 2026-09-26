"use client";

/* ---------------------------------------------------------------------------
   The reader's "Photos and files" (Reports Phase 2C).

   Photos as a grid of square previews (the small copy made on the phone, so
   a report with ten photos opens on a slow line); a tap opens the photo
   itself full-screen, with its caption, previous / next and download — on
   the Hub's own overlay (ScrollLockOverlay: a portal onto <body>, above the
   header; the report cards are glass, and a backdrop-filter ancestor turns
   position:fixed into "fixed to that card").
   Files as a list, each a download. Every address comes from
   reportFileUrl(): the bytes are served by /api/files/report/<id>, which
   applies the report's read rule on each request.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import RrIcon from "@/components/ui/RrIcon";
import { ScrollLockOverlay } from "@/hooks/useScrollLock";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import { reportFileUrl, sizeLabel, type ReportAttachment } from "@/lib/reports/attachments";
import { CARD, type T } from "./shared";

export default function AttachmentsView({ t, attachments }: { t: T; attachments: ReportAttachment[] }) {
  const photos = attachments.filter((a) => a.image);
  const files = attachments.filter((a) => !a.image);
  const [open, setOpen] = useState<number | null>(null);
  if (!attachments.length) return null;
  return (
    <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="kx-rep-attach">
      <h2 id="kx-rep-attach" className="mb-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">{t("attach.title")}</h2>
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((a, i) => (
            <li key={a.id} className="min-w-0">
              <button type="button" onClick={() => setOpen(i)} aria-label={a.caption || a.name}
                className="block aspect-square w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request-authorised file; next/image would cache it publicly */}
                <img src={reportFileUrl(a.id, a.hasThumb ? "thumb" : "full")} alt={a.caption || a.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
              {a.caption && <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-[var(--text-secondary)]"><AutoTranslatedText text={a.caption} plain /></p>}
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className={`space-y-1.5 ${photos.length ? "mt-3" : ""}`}>
          {files.map((a) => (
            <li key={a.id}>
              <a href={reportFileUrl(a.id, "download")} className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 hover:border-[var(--border-focus)]">
                <span className="text-[var(--text-dim)]"><RrIcon name="file" size={14} /></span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-primary)]" title={a.name}>{a.name}</span>
                <span className="shrink-0 text-[11px] text-[var(--text-dim)] tabular-nums">{sizeLabel(a.size)}</span>
                <span className="text-[var(--text-dim)]"><RrIcon name="download" size={13} /></span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {open !== null && photos[open] && <PhotoViewer t={t} photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}

export function PhotoViewer({ t, photos, index, onIndex, onClose }: {
  t: T; photos: ReportAttachment[]; index: number; onIndex: (i: number) => void; onClose: () => void;
}) {
  const a = photos[index];
  const many = photos.length > 1;
  const go = useCallback((d: number) => onIndex((index + d + photos.length) % photos.length), [index, photos.length, onIndex]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (many && e.key === "ArrowRight") go(document.dir === "rtl" ? -1 : 1);
      else if (many && e.key === "ArrowLeft") go(document.dir === "rtl" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, many, onClose]);
  return (
    <ScrollLockOverlay role="dialog" aria-modal="true" aria-label={a.caption || a.name} className="fixed inset-0 flex flex-col bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-[12px] tabular-nums text-white/70">{many ? t("attach.of").replace("{n}", String(index + 1)).replace("{m}", String(photos.length)) : ""}</span>
        <div className="flex items-center gap-2">
          <a href={reportFileUrl(a.id, "download")} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[12.5px] font-medium hover:bg-white/20">
            <RrIcon name="download" size={13} />{t("attach.download")}
          </a>
          <button type="button" onClick={onClose} aria-label={t("attach.close")} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/20"><RrIcon name="cross" size={12} /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-14">
        {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request-authorised file */}
        <img key={a.id} src={reportFileUrl(a.id)} alt={a.caption || a.name} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
        {many && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label={t("attach.prev")}
              className="absolute start-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
              <span className="inline-flex rtl:rotate-180"><RrIcon name="arrow-left" size={14} /></span>
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label={t("attach.next")}
              className="absolute end-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20">
              <span className="inline-flex rotate-180 rtl:rotate-0"><RrIcon name="arrow-left" size={14} /></span>
            </button>
          </>
        )}
      </div>
      <div className="min-h-[52px] px-4 pt-2 pb-[max(14px,env(safe-area-inset-bottom))] text-center text-[13px] text-white/85" onClick={(e) => e.stopPropagation()}>
        {a.caption ? <AutoTranslatedText text={a.caption} plain /> : <span className="text-white/45">{a.name}</span>}
      </div>
    </ScrollLockOverlay>
  );
}
