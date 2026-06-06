"use client";

/* ---------------------------------------------------------------------------
   FixEvidenceSection — Phase 9.2.

   Renders the "Fix Evidence" block on both the admin issue detail and the
   reporter view. For each fix cycle:
     BEFORE — the report's original screenshots (passed in as `beforeUrls`)
     AFTER  — the screenshots the developer attached to that cycle

   Side-by-side responsive grid with click-to-zoom (lightbox). Brand-
   monochrome, no decorative colour, hides cleanly when there's nothing.

   The lightbox is local: a fixed full-viewport overlay with one big image,
   click-to-close, ESC-to-close. We don't reach into a separate component
   because the rendering is identical to ScreenshotsGallery's lightbox and
   keeping it inline keeps this section self-contained.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

export interface EvidenceAttachment {
  path: string;
  url: string | null;
  type: string | null;
  size: number | null;
  label: string | null;
}
export interface FixEvidenceCycle {
  id: string;
  cycle_number: number;
  summary: string | null;
  commit_hash: string | null;
  pr_link: string | null;
  after_attachments: EvidenceAttachment[];
  created_by_name: string | null;
  created_at: string;
}

interface Props {
  beforeUrls: string[];
  cycles: FixEvidenceCycle[];
}

/** Pull every signed AFTER URL out of a cycle. Defensive: handles cases
 *  where some attachments are missing url (sign failed silently), where
 *  after_attachments is undefined, or the items aren't shaped as expected.
 *  Returns the unique URL list in order. */
function afterUrlsOf(cycle: FixEvidenceCycle): string[] {
  const raw = Array.isArray(cycle.after_attachments) ? cycle.after_attachments : [];
  const out = new Set<string>();
  for (const a of raw) {
    if (a && typeof (a as { url?: unknown }).url === "string" && (a as { url: string }).url.length > 0) {
      out.add((a as { url: string }).url);
    }
  }
  return Array.from(out);
}

function fmt(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
}

export default function FixEvidenceSection({ beforeUrls, cycles }: Props) {
  const [zoom, setZoom] = useState<string | null>(null);
  // Close lightbox on Esc + lock scroll while open.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(null); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [zoom]);

  if (cycles.length === 0) return null;

  return (
    <section
      data-kx-component="Fix Evidence"
      data-kx-module="QA"
      className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            Fix Evidence
          </div>
          <div className="text-[12px] text-[var(--text-secondary)]">
            {cycles.length} fix {cycles.length === 1 ? "cycle" : "cycles"} · BEFORE / AFTER comparison
          </div>
        </div>
      </header>

      {cycles.map((cycle) => (
        <article
          key={cycle.id}
          className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3"
        >
          {/* Cycle header */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="flex items-baseline gap-2">
              <span className="rounded bg-[var(--bg-inverted)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-inverted)]">
                Cycle {cycle.cycle_number}
              </span>
              <span className="text-[12px] text-[var(--text-secondary)]">
                {cycle.created_by_name ?? "—"} · {fmt(cycle.created_at)}
              </span>
            </div>
            {(cycle.commit_hash || cycle.pr_link) && (
              <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                {cycle.commit_hash && (
                  <code className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[var(--text-primary)]">
                    {cycle.commit_hash.slice(0, 12)}
                  </code>
                )}
                {cycle.pr_link && (
                  <a
                    href={cycle.pr_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--text-primary)] underline underline-offset-2 hover:opacity-80"
                  >
                    PR ↗
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Summary */}
          {cycle.summary && (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-primary)]">
              {cycle.summary}
            </p>
          )}

          {/* BEFORE / AFTER grid */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Pane
              label="Before"
              urls={beforeUrls}
              emptyText="No original screenshots were attached to this report."
              onZoom={setZoom}
            />
            <Pane
              label="After"
              urls={afterUrlsOf(cycle)}
              emptyText="No after screenshots attached to this cycle."
              onZoom={setZoom}
            />
          </div>
        </article>
      ))}

      {/* Lightbox */}
      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot zoom"
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[210] grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <img
            src={zoom}
            alt=""
            className="max-h-[92vh] max-w-[96vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/40 text-white"
          >
            ✕
          </button>
        </div>
      )}
    </section>
  );
}

function Pane({ label, urls, emptyText, onZoom }: {
  label: "Before" | "After";
  urls: string[];
  emptyText: string;
  onZoom: (url: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
      {urls.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-6 text-center text-[12px] text-[var(--text-dim)]">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {urls.map((u, i) => (
            <button
              key={u + i}
              type="button"
              onClick={() => onZoom(u)}
              className="block overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-transform hover:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
              aria-label={`${label} screenshot ${i + 1}`}
            >
              <img src={u} alt="" className="block max-h-56 w-full object-contain" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
