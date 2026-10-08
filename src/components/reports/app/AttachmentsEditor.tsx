"use client";

/* ---------------------------------------------------------------------------
   The composer's "Photos and files" card (Reports Phase 2C).

   A photo is made smaller on the phone first (preparePhoto: 2000 px + a
   480 px preview), then uploaded through our own route with a progress bar
   — one file at a time, so a slow line carries one thing well instead of
   five badly. A file that cannot go (type, size, a photo this device cannot
   open, the 20-per-report ceiling) is refused BEFORE the wait, with its
   name in the message, under the buttons that picked it.

   What was just uploaded shows from the phone's own copy (no download of
   what we just sent); everything else loads its small preview by id through
   /api/files/report/<id>/thumb. Tiles are square boxes, so nothing moves
   when an image arrives. Send waits while anything is still uploading
   (onBusy), so a report is never sent without the photo its author picked.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import RrIcon from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import {
  REPORT_ATTACHMENT_LIMITS, REPORT_FILE_ACCEPT, REPORT_PHOTO_ACCEPT, checkReportAttachment, reportFileUrl, sizeLabel, type ReportAttachment,
} from "@/lib/reports/attachments";
import { preparePhoto } from "@/lib/reports/prepare-photo";
import { captionReportAttachment, deleteReportAttachment, uploadReportAttachment } from "@/lib/work-reports";
import { CARD, FIELD, type T } from "./shared";

type Pending = { key: string; name: string; image: boolean; preview: string | null; progress: number; error: string | null; source: File };

const BTN = "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-focus)] disabled:opacity-50";

export default function AttachmentsEditor({ t, reportId, initial, onBusy, hide }: {
  t: T;
  reportId: string;
  initial: ReportAttachment[];
  onBusy: (busy: boolean) => void;
  /** Shown in place by a block (a checklist photo, a signature — Phase 4A). */
  hide?: ReadonlySet<string>;
}) {
  const [items, setItems] = useState<ReportAttachment[]>(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>(() => Object.fromEntries(initial.map((a) => [a.id, a.caption])));
  /* The phone's own copy of what was uploaded in this visit. */
  const [local, setLocal] = useState<Record<string, string>>({});
  const queue = useRef<Pending[]>([]);
  const running = useRef(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => { onBusy(pending.some((p) => !p.error)); }, [pending, onBusy]);
  useEffect(() => () => { for (const u of urls.current) URL.revokeObjectURL(u); }, []);

  const patch = (key: string, next: Partial<Pending>) => setPending((list) => list.map((p) => (p.key === key ? { ...p, ...next } : p)));
  const named = (key: string, name: string) => t(key).replace("{name}", name);

  /* One at a time, in the order they were picked. Started from a tap; the
     running flag keeps a second tap from starting a second loop. */
  const run = async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length) {
        const job = queue.current.shift()!;
        patch(job.key, { error: null, progress: 0 });
        let parts: { file: Blob; name: string; thumb?: Blob | null; width?: number; height?: number };
        if (job.image) {
          const ready = await preparePhoto(job.source);
          if (!ready) {
            /* The device could not open it; if it is a format we accept as
               it is, send it as it is. */
            if (!checkReportAttachment(job.source).ok) { patch(job.key, { error: named("attach.errPhoto", job.name) }); continue; }
            parts = { file: job.source, name: job.name };
          } else {
            parts = { file: ready.file, name: ready.file.name, thumb: ready.thumb, width: ready.width, height: ready.height };
          }
        } else {
          parts = { file: job.source, name: job.name };
        }
        const res = await uploadReportAttachment(reportId, parts, (f) => patch(job.key, { progress: f }));
        if (res.ok) {
          const a = res.data.attachment;
          if (job.preview) setLocal((m) => ({ ...m, [a.id]: job.preview! }));
          setItems((list) => [...list, a]);
          setCaptions((c) => ({ ...c, [a.id]: a.caption }));
          setPending((list) => list.filter((p) => p.key !== job.key));
        } else {
          const why = res.error === "too_large" ? named("attach.errSize", job.name)
            : res.error === "bad_type" ? named("attach.errType", job.name)
            : res.error === "too_many" ? t("attach.errMax")
            : named("attach.errUpload", job.name);
          patch(job.key, { error: why });
        }
      }
    } finally {
      running.current = false;
    }
  };

  const pick = (files: FileList | null) => {
    if (!files?.length) return;
    const room = REPORT_ATTACHMENT_LIMITS.perReport - items.length - pending.length;
    const list = Array.from(files);
    const refused: string[] = [];
    const jobs: Pending[] = [];
    for (const f of list.slice(0, Math.max(0, room))) {
      const image = f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);
      if (!image) {
        const v = checkReportAttachment(f);
        if (!v.ok) { refused.push(v.reason === "size" ? named("attach.errSize", f.name) : named("attach.errType", f.name)); continue; }
      }
      const preview = image ? URL.createObjectURL(f) : null;
      if (preview) urls.current.push(preview);
      jobs.push({ key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: f.name || "file", image, preview, progress: 0, error: null, source: f });
    }
    if (list.length > room) refused.push(t("attach.errMax"));
    setProblem(refused.length ? refused.join(" ") : null);
    if (!jobs.length) return;
    setPending((p) => [...p, ...jobs]);
    queue.current.push(...jobs);
    void run();
  };

  const retry = (key: string) => {
    const job = pending.find((p) => p.key === key);
    if (!job) return;
    patch(key, { error: null, progress: 0 });
    queue.current.push(job);
    void run();
  };
  const drop = (key: string) => setPending((list) => list.filter((p) => p.key !== key));

  const remove = async (a: ReportAttachment) => {
    setConfirming(null);
    setItems((list) => list.filter((x) => x.id !== a.id));
    const res = await deleteReportAttachment(reportId, a.id);
    if (!res.ok) { setItems((list) => [...list, a]); setProblem(t("err.generic")); }
  };
  const saveCaption = async (a: ReportAttachment) => {
    const next = (captions[a.id] ?? "").trim();
    if (next === a.caption) return;
    const res = await captionReportAttachment(reportId, a.id, next);
    if (res.ok) setItems((list) => list.map((x) => (x.id === a.id ? res.data.attachment : x)));
    else setProblem(t("err.generic"));
  };

  const listed = hide?.size ? items.filter((a) => !hide.has(a.id)) : items;
  const photos = listed.filter((a) => a.image);
  const files = listed.filter((a) => !a.image);
  const pendingPhotos = pending.filter((p) => p.image);
  const pendingFiles = pending.filter((p) => !p.image);
  const full = items.length + pending.length >= REPORT_ATTACHMENT_LIMITS.perReport;

  return (
    <section className={`${CARD} p-4`} aria-labelledby="kx-attach-title">
      {/* On a phone the buttons take their own row, so the words keep the
          card's full width instead of a sliver beside them. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 sm:flex-1">
          <h2 id="kx-attach-title" className="text-[12px] font-semibold text-[var(--text-secondary)]">{t("attach.title")}</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--text-dim)]">{t("attach.hint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <button type="button" className={BTN} disabled={full} onClick={() => photoInput.current?.click()}><RrIcon name="camera" size={14} />{t("attach.addPhotos")}</button>
          <button type="button" className={BTN} disabled={full} onClick={() => fileInput.current?.click()}><RrIcon name="file" size={14} />{t("attach.addFiles")}</button>
          {/* Visually hidden, not display:none — some phone browsers will not
              open a picker for an input that is not rendered at all. */}
          <input ref={photoInput} type="file" accept={REPORT_PHOTO_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          <input ref={fileInput} type="file" accept={REPORT_FILE_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
        </div>
      </div>
      {problem && <p role="alert" className="mt-3 text-[12px] text-amber-500">{problem}</p>}

      {(photos.length > 0 || pendingPhotos.length > 0) && (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((a) => (
            <li key={a.id} className="min-w-0">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- a private, per-request-authorised file; next/image would cache it publicly */}
                <img src={local[a.id] ?? reportFileUrl(a.id, a.hasThumb ? "thumb" : "full")} alt={a.caption || a.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                {confirming === a.id ? (
                  <div className="absolute inset-0 grid place-items-center bg-black/60 p-2 backdrop-blur-sm">
                    <div className="flex flex-col items-stretch gap-1.5">
                      <button type="button" onClick={() => void remove(a)} className="h-8 rounded-lg bg-red-500/90 px-3 text-[12px] font-semibold text-white">{t("attach.remove")}</button>
                      <button type="button" onClick={() => setConfirming(null)} className="h-8 rounded-lg bg-white/15 px-3 text-[12px] text-white">{t("composer.cancel")}</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirming(a.id)} aria-label={`${t("attach.remove")}: ${a.name}`}
                    className="absolute end-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75">
                    <RrIcon name="cross" size={10} />
                  </button>
                )}
              </div>
              <input dir="auto" value={captions[a.id] ?? ""} maxLength={REPORT_ATTACHMENT_LIMITS.caption} placeholder={t("attach.caption")} aria-label={`${t("attach.caption")} ${a.name}`}
                onChange={(e) => setCaptions((c) => ({ ...c, [a.id]: e.target.value }))}
                onBlur={() => void saveCaption(a)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className={`${FIELD} mt-1 h-8 px-2 py-1 text-[11.5px]`} />
            </li>
          ))}
          {pendingPhotos.map((p) => (
            <li key={p.key} className="min-w-0">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- the phone's own copy, a blob: URL */}
                {p.preview && <img src={p.preview} alt="" className={`h-full w-full object-cover ${p.error ? "opacity-40" : "opacity-60"}`} />}
                {p.error ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/45 p-2 text-center">
                    <button type="button" onClick={() => retry(p.key)} className="h-7 rounded-lg bg-white/90 px-2.5 text-[11.5px] font-semibold text-black">{t("attach.retry")}</button>
                    <button type="button" onClick={() => drop(p.key)} className="h-7 rounded-lg bg-white/15 px-2.5 text-[11.5px] text-white">{t("attach.remove")}</button>
                  </div>
                ) : (
                  <div className="absolute inset-x-2 bottom-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                      <div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${Math.round(p.progress * 100)}%` }} />
                    </div>
                  </div>
                )}
              </div>
              {p.error && <p className="mt-1 line-clamp-2 text-[11px] text-amber-500">{p.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {(files.length > 0 || pendingFiles.length > 0) && (
        <ul className="mt-3 space-y-1.5">
          {files.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
              <span className="text-[var(--text-dim)]"><RrIcon name="file" size={14} /></span>
              <a href={reportFileUrl(a.id, "download")} className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-primary)] hover:underline" title={a.name}>{a.name}</a>
              <span className="shrink-0 text-[11px] text-[var(--text-dim)] tabular-nums">{sizeLabel(a.size)}</span>
              {confirming === a.id ? (
                <span className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => void remove(a)} className="h-7 rounded-lg bg-red-500/85 px-2.5 text-[11.5px] font-semibold text-white">{t("attach.remove")}</button>
                  <button type="button" onClick={() => setConfirming(null)} className="h-7 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[11.5px]">{t("composer.cancel")}</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming(a.id)} aria-label={`${t("attach.remove")}: ${a.name}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--text-dim)] hover:text-red-500">
                  <RrIcon name="cross" size={10} />
                </button>
              )}
            </li>
          ))}
          {pendingFiles.map((p) => (
            <li key={p.key} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
              <div className="flex items-center gap-2.5">
                <span className="text-[var(--text-dim)]">{p.error ? <RrIcon name="file" size={14} /> : <SpinnerIcon size={14} />}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-secondary)]">{p.name}</span>
                {p.error ? (
                  <span className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => retry(p.key)} className="h-7 rounded-lg border border-[var(--border-subtle)] px-2.5 text-[11.5px] font-semibold">{t("attach.retry")}</button>
                    <button type="button" onClick={() => drop(p.key)} className="h-7 rounded-lg px-2 text-[11.5px] text-[var(--text-dim)]">{t("attach.remove")}</button>
                  </span>
                ) : <span className="shrink-0 text-[11px] text-[var(--text-dim)] tabular-nums">{Math.round(p.progress * 100)}%</span>}
              </div>
              {p.error && <p className="mt-1 text-[11px] text-amber-500">{p.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
