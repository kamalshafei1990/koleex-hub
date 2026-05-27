"use client";

/* ---------------------------------------------------------------------------
   CodeBuilder — live Lockstitch SKU generator.

   Each Lockstitch axis is rendered as a segmented selector; the built
   code updates in real-time at the top, and a minimal sewing-machine
   silhouette highlights the area each axis controls (motor box,
   workbench length, fabric pad, hook ring, etc.). Copy-to-clipboard
   on the final code.

   Single SVG silhouette, monochrome, inherits text color via
   currentColor so it matches both dark and light Hub themes.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import { LOCKSTITCH } from "./data";
import { HubIcon } from "./icon-registry";
import { taxonomyLogoUrl } from "./taxonomy-logo";

type Selection = Record<number, string | null>;

/* Axis → which silhouette region to highlight when that axis is active. */
const AXIS_REGION: Record<number, "head" | "motor" | "bed" | "length" | "fabric" | "hook" | "special" | null> = {
  1: "head",     // Model code
  2: "head",     // Function
  3: "bed",      // Seam table
  4: "motor",    // Motor
  5: "length",   // Operation length
  6: "fabric",   // Fabrics
  7: "hook",     // Hook
  8: "special",  // Special
};

export default function CodeBuilder() {
  const initial: Selection = useMemo(() => {
    const s: Selection = {};
    for (const seg of LOCKSTITCH.segments) {
      s[seg.index] = seg.empty ? null : seg.value;
    }
    return s;
  }, []);
  const [sel, setSel] = useState<Selection>(initial);
  const [activeAxis, setActiveAxis] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  /* Build the joined code from current selection. Segments 1+2 are
     concatenated without a dash (e.g. Q10 + 5 = "Q10-5" stays apart);
     we follow the printed grammar: prefix-seg1-seg2[-seg3...]. Empty
     axes are omitted. */
  const built = useMemo(() => {
    const parts: string[] = [LOCKSTITCH.prefix];
    for (const seg of LOCKSTITCH.segments) {
      const v = sel[seg.index];
      if (v && v !== "") parts.push(v);
    }
    return parts.join("-");
  }, [sel]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(built);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* ── Live code header ── */}
      <div
        className="px-5 sm:px-7 py-5 border-b border-[var(--border-faint)] flex flex-wrap items-center justify-between gap-4"
        style={{
          background:
            "radial-gradient(120% 80% at 20% 0%, var(--bg-surface-hover) 0%, transparent 60%), var(--bg-secondary)",
        }}
      >
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] flex items-center gap-2">
            <span
              aria-hidden
              className="relative flex h-1.5 w-1.5"
            >
              <span className="absolute inset-0 rounded-full bg-emerald-500/60 animate-ping" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Live SKU builder
          </div>
          <div className="mt-2 font-mono text-[22px] sm:text-[28px] font-bold tracking-wider text-[var(--text-primary)] truncate">
            {built}
          </div>
        </div>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
        >
          <HubIcon
            domain="utility"
            k={copied ? "check" : "copy"}
            size={13}
          />
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* ── Axis selectors ── */}
        <div className="p-5 sm:p-7 space-y-4 border-r border-[var(--border-faint)]">
          {LOCKSTITCH.segments.map((seg) => {
            const table = LOCKSTITCH.tables.find(
              (t) => t.segmentNumber === seg.index,
            );
            if (!table) return null;
            const options = table.rows.map((r) => ({
              value: r.code === "/" ? "" : r.code,
              label: r.meaning,
              code: r.code,
            }));
            const current = sel[seg.index] ?? "";
            return (
              <div
                key={seg.index}
                onMouseEnter={() => setActiveAxis(seg.index)}
                onMouseLeave={() => setActiveAxis(null)}
                className={`rounded-lg p-3 transition-colors ${
                  activeAxis === seg.index
                    ? "bg-[var(--bg-surface-subtle)]"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold leading-none">
                    {seg.index}
                  </div>
                  <div className="text-[11.5px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    {seg.header}
                  </div>
                  {seg.sub && (
                    <div className="text-[10px] text-[var(--text-faint)]">
                      {seg.sub}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {options.map((o) => {
                    const isActive = current === o.value;
                    return (
                      <button
                        key={o.code}
                        type="button"
                        onClick={() =>
                          setSel((s) => ({
                            ...s,
                            [seg.index]: o.value,
                          }))
                        }
                        className={`h-7 px-2.5 rounded-md border text-[11px] font-mono transition-colors ${
                          isActive
                            ? "bg-[var(--text-primary)] text-[var(--bg-primary)] border-[var(--text-primary)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
                        }`}
                        title={o.label}
                      >
                        <span className="font-bold">{o.code}</span>
                        <span className="ml-1.5 hidden sm:inline opacity-80 font-sans font-medium">
                          {o.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Machine silhouette ── */}
        <div className="p-5 sm:p-7 flex flex-col items-center justify-start text-[var(--text-primary)] bg-[var(--bg-surface-subtle)]">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] mb-3 self-start">
            Machine map
          </div>
          <MachineMap
            activeRegion={activeAxis ? AXIS_REGION[activeAxis] : null}
          />
          <div className="mt-4 text-[11px] text-[var(--text-faint)] leading-relaxed self-start">
            Each axis lights up the part of the machine it controls.
            Hover any axis on the left to map it onto the silhouette.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Machine map ────────────────────────────────────────────────────────
   v7: pulls the real KOLEEX lockstitch line drawing from Supabase
   Storage at media/machines/lockstitch.png. Falls back to .svg, then
   to a "upload pending" placeholder so the page still works before
   the image lands. A small caption strip below the image identifies
   the active region — minimal interaction by design (the image
   carries all the visual weight). */

function MachineMap({
  activeRegion,
}: {
  activeRegion: AxisRegion | null;
}) {
  /* Lookup order — first one that exists wins:
       1. /knowledge/lockstitch.png   (bundled with the repo, no upload needed)
       2. /knowledge/lockstitch.svg   (same — for vector assets)
       3. Supabase Storage PNG        (for brand-team uploads without code change)
       4. Supabase Storage SVG
       5. Placeholder ("awaiting asset" card)
     Each step on error falls to the next. */
  const sources: Array<{ id: string; url: string | null }> = [
    { id: "public-png", url: "/knowledge/lockstitch.png" },
    { id: "public-svg", url: "/knowledge/lockstitch.svg" },
    { id: "storage-png", url: taxonomyLogoUrl("machines", "lockstitch", "png") },
    { id: "storage-svg", url: taxonomyLogoUrl("machines", "lockstitch", "svg") },
  ].filter((s) => !!s.url);

  const [step, setStep] = useState(0);
  const current = sources[step];
  const src = current?.url ?? null;

  return (
    <div className="w-full">
      {src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt="KOLEEX Lockstitch — technical line drawing"
          className="w-full h-auto rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)] p-2"
          /* Invert the line drawing in dark mode so black lines on
             white become white lines on dark. Light mode renders
             unmodified. */
          style={{
            filter: "invert(0)",
          }}
          onError={() => {
            /* Try the next source in priority order. When we've
               exhausted all of them, step++ goes past the array
               length and `current` becomes undefined → src becomes
               null → placeholder renders. */
            if (step < sources.length - 1) setStep((s) => s + 1);
            else setStep(sources.length);
          }}
        />
      ) : (
        <MachineMapPlaceholder />
      )}

      {/* Caption strip — shows the active axis label or a hint */}
      <div className="mt-3 px-3 py-2 rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] text-center">
        {activeRegion ? (
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-primary)] font-mono">
            ◉ {regionLabel(activeRegion)}
          </div>
        ) : (
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
            Hover an axis to highlight what it controls
          </div>
        )}
      </div>
    </div>
  );
}

/* Discriminated union for the axis-region mapping, declared once. */
type AxisRegion =
  | "head"
  | "motor"
  | "bed"
  | "length"
  | "fabric"
  | "hook"
  | "special";

/* Fallback when no machine image is available at any of the
   configured paths. Names both options so the operator can pick. */
function MachineMapPlaceholder() {
  return (
    <div className="w-full aspect-[4/3] rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] flex flex-col items-center justify-center text-center px-6 py-8 gap-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
        Machine map · awaiting asset
      </div>
      <p className="text-[12.5px] text-[var(--text-muted)] max-w-sm leading-relaxed">
        Drop the KOLEEX Lockstitch line drawing at{" "}
        <span className="font-mono text-[var(--text-primary)]">
          public/knowledge/lockstitch.png
        </span>{" "}
        in the repo (or upload to Supabase Storage at{" "}
        <span className="font-mono text-[var(--text-primary)]">
          media/machines/lockstitch.png
        </span>
        ) and the map appears automatically.
      </p>
    </div>
  );
}


function regionLabel(r: AxisRegion): string {
  switch (r) {
    case "head":
      return "MACHINE HEAD";
    case "motor":
      return "MOTOR";
    case "bed":
      return "BED";
    case "length":
      return "OPERATION LENGTH";
    case "fabric":
      return "FABRIC PAD";
    case "hook":
      return "HOOK";
    case "special":
      return "ACCESSORY RAIL";
  }
}
