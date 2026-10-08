"use client";

/* ProductMedia — Media & Files: the gallery as a grid, the videos, the
 * AR link, the documents. A grid, not a carousel: every picture is visible
 * without a gesture, and the grid is the same shape on every product.
 */
import { IMG } from "@/lib/cdn";
import VisualGlyph from "./VisualGlyph";
import { fileNameFromUrl, SectionHead } from "./shared";

export default function ProductMedia({ name, gallery, videos, ar3dUrl, manuals, t }: {
  name: string;
  gallery: string[];
  videos: string[];
  ar3dUrl: string | null;
  manuals: Array<{ url: string; label?: string | null }>;
  t: (key: string, fallback?: string) => string;
}) {
  if (gallery.length === 0 && videos.length === 0 && !ar3dUrl && manuals.length === 0) return null;
  /* The dictionary phrases carry an {n} slot ("{n} photos" / "{n} 张照片"). */
  const n = (key: string, fallback: string, v: number) => t(key, fallback).replace("{n}", String(v));
  const count = [
    gallery.length ? n("preview.countPhotos", "{n} photos", gallery.length) : "",
    videos.length ? n("preview.countVideos", "{n} videos", videos.length) : "",
    manuals.length ? n("preview.countDocuments", "{n} documents", manuals.length) : "",
  ].filter(Boolean).join(" · ");
  return (
    <section id="media" className="space-y-6">
      <SectionHead eyebrow={t("preview.navMedia", "Media & Files")} title={t("preview.media", "Media")} aside={count} />

      {gallery.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {gallery.map((url, i) => (
            <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.gallery(url)} alt={`${name} ${i + 1}`} loading="lazy" decoding="async" className="h-full w-full object-contain p-2" />
            </a>
          ))}
        </div>
      ) : null}

      {videos.length > 0 || ar3dUrl ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {videos.map((url, i) => (
            <div key={`${url}-${i}`} className="aspect-video overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-black">
              <video src={url} controls preload="metadata" playsInline className="h-full w-full object-contain" />
            </div>
          ))}
          {ar3dUrl ? (
            <a href={ar3dUrl} target="_blank" rel="noopener noreferrer" className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] transition-colors hover:bg-[var(--bg-surface-hover)]">
              <VisualGlyph token="spark" className="h-5 w-5 text-[var(--text-secondary)]" />
              <span className="text-[12px] uppercase tracking-[0.14em] text-[var(--text-dim)]">{t("preview.viewIn3dAr", "View in 3D / AR")}</span>
            </a>
          ) : null}
        </div>
      ) : null}

      {manuals.length > 0 ? (
        <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
          {manuals.map((m, i) => (
            <li key={`${m.url}-${i}`}>
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 px-4 py-3 text-[14px] transition-colors hover:bg-[var(--bg-surface-subtle)]">
                <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">{m.label || fileNameFromUrl(m.url)}</span>
                <span className="shrink-0 text-[12px] font-medium text-[#0066FF]">{t("preview.download", "Download")}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
