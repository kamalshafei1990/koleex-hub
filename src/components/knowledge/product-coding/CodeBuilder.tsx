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
  /* Source priority — first that loads wins:
       1. /knowledge/lockstitch.svg   ← KOLEEX vector trace (canonical)
       2. /knowledge/lockstitch.png
       3. Supabase Storage SVG / PNG
       4. Inline schematic fallback (hand-coded SVG)
  */
  const sources: Array<{ id: string; url: string | null }> = [
    { id: "public-svg", url: "/knowledge/lockstitch.svg" },
    { id: "public-png", url: "/knowledge/lockstitch.png" },
    { id: "storage-svg", url: taxonomyLogoUrl("machines", "lockstitch", "svg") },
    { id: "storage-png", url: taxonomyLogoUrl("machines", "lockstitch", "png") },
  ].filter((s) => !!s.url);

  const [step, setStep] = useState(0);
  const current = sources[step];
  const src = current?.url ?? null;
  const exhausted = step >= sources.length;

  return (
    <div className="w-full">
      <div className="rounded-lg border border-[var(--border-faint)] bg-[var(--bg-primary)] p-2 overflow-hidden">
        {exhausted ? (
          /* All remote sources failed — drop in the hand-coded schematic
             so the section never goes blank. */
          <LockstitchLineDrawing activeRegion={activeRegion} />
        ) : src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt="KOLEEX Lockstitch — technical line drawing"
            className="w-full h-auto"
            /* The vector trace is black-on-white. In dark mode invert so
               the strokes read on a dark background; light mode passes
               through unchanged. */
            style={{
              filter: "var(--lockstitch-filter, none)",
              mixBlendMode: "normal",
            }}
            onError={() => setStep((s) => s + 1)}
          />
        ) : null}
      </div>

      {/* Caption strip */}
      <div className="mt-3 px-3 py-2 rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] text-center">
        {activeRegion ? (
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-primary)] font-mono">
            ◉ {regionLabel(activeRegion)}
          </div>
        ) : (
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
            Hover an axis on the left — caption updates below
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Inline line drawing of an industrial lockstitch sewing machine.
   Modeled on the KOLEEX reference: long bed, head on the left with
   spool tower and take-up lever, arm extending right with a large
   digital control panel (LCD + S-button + function grid), handwheel
   on the right side, four legs, underbed motor + belt.

   All strokes use currentColor so the same component renders cleanly
   in light and dark themes. Active region gets stroke-width:1.8;
   idle is 1. Fine details run at 0.5–0.6 for the technical-drawing
   feel from the reference. */

function LockstitchLineDrawing({
  activeRegion,
}: {
  activeRegion: AxisRegion | null;
}) {
  const sw = (region: AxisRegion, active = 1.8, idle = 1) =>
    activeRegion === region ? active : idle;

  return (
    <svg
      viewBox="0 0 640 460"
      className="w-full h-auto"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--text-primary)" }}
    >
      {/* ── BED — long workbench across the bottom ─────────────────── */}
      <g strokeWidth={sw("bed")}>
        {/* Top deck */}
        <path d="M 30 310 L 590 310 L 605 322 L 605 360 L 25 360 L 25 322 Z" />
        {/* Front lip seam */}
        <line x1="25" y1="340" x2="605" y2="340" strokeWidth={0.6} />
        {/* Needle plate cutout — top of the bed near the needle */}
        <rect x="195" y="305" width="38" height="8" rx="1" strokeWidth={0.7} />
        {/* Bobbin plate cover */}
        <ellipse cx="280" cy="320" rx="14" ry="4" strokeWidth={0.7} />
      </g>

      {/* ── LENGTH ruler — tick marks under the bed (axis 5) ───────── */}
      <g strokeWidth={sw("length", 1.2, 0.7)}>
        {[60, 120, 180, 260, 340, 420, 500, 560].map((x) => (
          <line key={x} x1={x} y1="360" x2={x} y2="370" />
        ))}
        <line x1="30" y1="372" x2="590" y2="372" strokeWidth={0.5} />
      </g>

      {/* ── HEAD — left vertical body with the iconic Z-profile ─────── */}
      <g strokeWidth={sw("head")}>
        {/* Main head silhouette */}
        <path
          d="
            M 70 310
            L 70 110
            Q 70 75 110 75
            L 220 75
            Q 250 75 260 95
            L 280 130
            L 290 170
            L 280 200
            L 280 260
            Q 280 290 250 300
            L 230 308
            L 220 310
            Z
          "
        />
        {/* Top deck of the head — small flat where bobbin winder + tensioner sit */}
        <line x1="110" y1="78" x2="220" y2="78" strokeWidth={0.6} />
        {/* KOLEEX label box on the front face */}
        <rect x="100" y="190" width="56" height="28" rx="2" strokeWidth={0.8} />
        <text
          x="128"
          y="208"
          textAnchor="middle"
          fontSize="9"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="700"
          fill="currentColor"
          stroke="none"
          style={{ letterSpacing: "0.08em" }}
        >
          KOLEEX
        </text>
        {/* Inspection oval cut-out on the face */}
        <ellipse cx="180" cy="260" rx="6" ry="9" strokeWidth={0.5} />
        {/* Oil sight glass */}
        <circle cx="155" cy="265" r="2" strokeWidth={0.5} />
      </g>

      {/* ── TENSIONER + TAKE-UP LEVER on the front of the head ─────── */}
      <g strokeWidth={sw("head", 1.3, 0.7)}>
        {/* Tensioner disc */}
        <circle cx="135" cy="160" r="8" />
        <circle cx="135" cy="160" r="2.5" fill="currentColor" />
        {/* Take-up lever — diagonal arm */}
        <path d="M 145 152 L 175 130 L 192 142 L 162 162 Z" strokeWidth={0.8} />
        <circle cx="186" cy="138" r="2" fill="currentColor" />
        {/* Small lever pivot */}
        <circle cx="145" cy="155" r="1.5" fill="currentColor" />
      </g>

      {/* ── BOBBIN WINDER on top of the head ───────────────────────── */}
      <g strokeWidth={sw("head", 1.3, 0.7)}>
        <rect x="118" y="58" width="20" height="16" rx="1" />
        <circle cx="128" cy="66" r="3.5" />
        <circle cx="128" cy="66" r="1" fill="currentColor" />
      </g>

      {/* ── SPOOL STAND with thread cone on top of the head ────────── */}
      <g strokeWidth={sw("head", 1.2, 0.6)}>
        {/* Vertical rod */}
        <line x1="180" y1="20" x2="180" y2="75" />
        {/* Top knob */}
        <circle cx="180" cy="20" r="3" />
        {/* Thread cone */}
        <path d="M 170 60 L 180 30 L 190 60 Z" strokeWidth={0.8} />
        {/* Cone base ring */}
        <ellipse cx="180" cy="60" rx="11" ry="3" strokeWidth={0.6} />
        {/* Second spool (smaller, behind) */}
        <line x1="210" y1="30" x2="210" y2="75" strokeWidth={0.6} />
        <circle cx="210" cy="30" r="2" strokeWidth={0.5} />
      </g>

      {/* ── ARM — horizontal body extending right from the head ────── */}
      <g strokeWidth={sw("head")}>
        <path
          d="
            M 220 145
            L 540 145
            Q 560 145 560 162
            L 560 270
            Q 560 280 550 282
            L 295 282
            Q 285 280 285 270
            L 285 200
            L 220 200
            Z
          "
        />
        {/* Brand stripe along the arm */}
        <line x1="305" y1="160" x2="540" y2="160" strokeWidth={0.5} />
      </g>

      {/* ── DIGITAL CONTROL PANEL on the front of the arm (special) ── */}
      <g strokeWidth={sw("special")}>
        {/* Panel bezel */}
        <rect x="370" y="160" width="180" height="120" rx="4" />
        {/* LCD display */}
        <rect x="382" y="170" width="156" height="46" rx="2" strokeWidth={0.8} />
        <text
          x="416"
          y="196"
          fontSize="13"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fontWeight="700"
          fill="currentColor"
          stroke="none"
          style={{ letterSpacing: "0.05em" }}
        >
          3333
        </text>
        {/* Boxed sub-value */}
        <rect x="486" y="184" width="40" height="20" rx="1" strokeWidth={0.5} />
        <text
          x="506"
          y="200"
          textAnchor="middle"
          fontSize="11"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fontWeight="700"
          fill="currentColor"
          stroke="none"
        >
          3.5
        </text>
        <text
          x="390"
          y="212"
          fontSize="6.5"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fill="currentColor"
          stroke="none"
        >
          A1
        </text>

        {/* S button + arrows cluster */}
        <circle cx="460" cy="240" r="11" strokeWidth={0.8} />
        <text
          x="460"
          y="244"
          textAnchor="middle"
          fontSize="11"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="700"
          fill="currentColor"
          stroke="none"
        >
          S
        </text>
        {/* + above */}
        <line x1="460" y1="222" x2="460" y2="226" strokeWidth={0.6} />
        <line x1="458" y1="224" x2="462" y2="224" strokeWidth={0.6} />
        {/* − below */}
        <line x1="458" y1="256" x2="462" y2="256" strokeWidth={0.6} />
        {/* ← left */}
        <path d="M 442 240 L 446 237 M 442 240 L 446 243" strokeWidth={0.6} />
        {/* → right */}
        <path d="M 478 240 L 474 237 M 478 240 L 474 243" strokeWidth={0.6} />

        {/* Side circular buttons */}
        <circle cx="420" cy="240" r="6" strokeWidth={0.7} />
        <circle cx="500" cy="240" r="6" strokeWidth={0.7} />
        <text
          x="420"
          y="243"
          textAnchor="middle"
          fontSize="6"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="700"
          fill="currentColor"
          stroke="none"
        >
          W
        </text>
        <text
          x="500"
          y="243"
          textAnchor="middle"
          fontSize="6"
          fontFamily="ui-sans-serif, system-ui"
          fontWeight="700"
          fill="currentColor"
          stroke="none"
        >
          P
        </text>

        {/* Function key grid below (4 × 2) */}
        {[
          [0, 0],
          [1, 0],
          [2, 0],
          [3, 0],
          [0, 1],
          [1, 1],
          [2, 1],
          [3, 1],
        ].map(([cx, ry], i) => (
          <rect
            key={i}
            x={386 + cx * 39}
            y={258 + ry * 12}
            width="36"
            height="10"
            rx="1.5"
            strokeWidth={0.5}
          />
        ))}
      </g>

      {/* ── NEEDLE BAR + presser foot ──────────────────────────────── */}
      <g strokeWidth={sw("head")}>
        <line x1="215" y1="282" x2="215" y2="310" />
        {/* Presser foot */}
        <path d="M 208 310 L 222 310 L 218 318 L 212 318 Z" strokeWidth={0.7} />
      </g>

      {/* ── FABRIC sliver under the presser foot ───────────────────── */}
      <g
        strokeWidth={sw("fabric", 1.4, 0.7)}
        fill={activeRegion === "fabric" ? "currentColor" : "none"}
        opacity={activeRegion === "fabric" ? 0.2 : 1}
      >
        <path d="M 165 312 L 240 312 L 235 318 L 170 318 Z" />
      </g>

      {/* ── HOOK / bobbin area below the needle ─────────────────────── */}
      <g strokeWidth={sw("hook")}>
        <circle cx="215" cy="338" r="8" />
        <circle cx="215" cy="338" r="3" />
        <line x1="215" y1="318" x2="215" y2="330" strokeWidth={0.6} />
      </g>

      {/* ── HANDWHEEL on the right side of the arm ─────────────────── */}
      <g strokeWidth={sw("head", 1.4, 0.9)}>
        <circle cx="585" cy="215" r="22" />
        <circle cx="585" cy="215" r="6" fill="currentColor" />
        {/* Spokes */}
        {[0, 45, 90, 135].map((deg) => {
          const a = (deg * Math.PI) / 180;
          const x1 = 585 + Math.cos(a) * 8;
          const y1 = 215 + Math.sin(a) * 8;
          const x2 = 585 + Math.cos(a) * 20;
          const y2 = 215 + Math.sin(a) * 20;
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={0.5}
            />
          );
        })}
      </g>

      {/* ── LEGS — four verticals from bed to floor ────────────────── */}
      <g strokeWidth={sw("bed", 1.2, 0.8)}>
        <line x1="60" y1="360" x2="60" y2="440" />
        <line x1="240" y1="360" x2="240" y2="440" />
        <line x1="430" y1="360" x2="430" y2="440" />
        <line x1="580" y1="360" x2="580" y2="440" />
        {/* Foot caps */}
        {[60, 240, 430, 580].map((x) => (
          <line key={x} x1={x - 4} y1="440" x2={x + 4} y2="440" strokeWidth={1} />
        ))}
      </g>

      {/* ── MOTOR + belt linkage under the bed ─────────────────────── */}
      <g strokeWidth={sw("motor")}>
        {/* Motor housing */}
        <rect x="290" y="370" width="120" height="48" rx="3" />
        {/* Pulley on the bed underside */}
        <circle cx="280" cy="370" r="8" strokeWidth={0.8} />
        {/* Motor pulley */}
        <circle cx="350" cy="394" r="6" strokeWidth={0.8} />
        {/* Belt */}
        <path d="M 280 378 Q 310 396 350 388" strokeWidth={0.7} />
        <path d="M 280 362 Q 320 376 350 400" strokeWidth={0.7} />
        {/* Power cable */}
        <path d="M 410 410 Q 440 420 460 432" strokeWidth={0.8} />
        {/* Fan vents */}
        <line x1="298" y1="380" x2="314" y2="380" strokeWidth={0.5} />
        <line x1="298" y1="390" x2="314" y2="390" strokeWidth={0.5} />
        <line x1="298" y1="400" x2="314" y2="400" strokeWidth={0.5} />
      </g>

      {/* ── ACCESSORY rail on the right edge of the bed ─────────────── */}
      <g strokeWidth={sw("special", 1.2, 0.6)}>
        <line
          x1="490"
          y1="306"
          x2="595"
          y2="306"
          strokeDasharray={activeRegion === "special" ? "0" : "3 2"}
        />
        <rect x="510" y="297" width="32" height="9" rx="1.5" strokeWidth={0.7} />
      </g>
    </svg>
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
