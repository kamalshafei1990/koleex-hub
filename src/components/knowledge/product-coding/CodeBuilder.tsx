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

import { memo, useMemo, useState } from "react";
import { LOCKSTITCH } from "./data";
import { HubIcon } from "./icon-registry";
import { useT, useTL } from "./i18n";
import { HeaderShell } from "./primitives";

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
  const t = useT();
  const tl = useTL();
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
      <HeaderShell
        eyebrow={<>{t("builder.live_builder")}</>}
        primary={
          <div
            className="font-mono text-[22px] sm:text-[28px] font-bold tracking-wider text-[var(--text-primary)] truncate"
            dir="ltr"
          >
            {built}
          </div>
        }
        trailing={
          <button
            type="button"
            onClick={copy}
            className="no-print flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
          >
            <HubIcon
              domain="utility"
              k={copied ? "check" : "copy"}
              size={13}
            />
            {copied ? t("builder.copied") : t("builder.copy_code")}
          </button>
        }
      />

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
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold leading-none"
                    dir="ltr"
                  >
                    {seg.index}
                  </div>
                  <div className="text-[11.5px] font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                    {tl(seg.header)}
                  </div>
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
                        title={tl(o.label)}
                      >
                        <span className="font-bold" dir="ltr">{o.code}</span>
                        <span className="ml-1.5 hidden sm:inline opacity-80 font-sans font-medium">
                          {tl(o.label)}
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
            {t("builder.machine_map")}
          </div>
          <MachineMap
            activeRegion={activeAxis ? AXIS_REGION[activeAxis] : null}
          />
          <div className="mt-4 text-[11px] text-[var(--text-faint)] leading-relaxed self-start">
            {t("builder.hint")}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Machine map ────────────────────────────────────────────────────────
   v14: inline-only SVG of an industrial lockstitch sewing machine. The
   photo-loading fallback chain is gone — we render a properly-
   proportioned silhouette that highlights each axis-region on hover.

   Silhouette geometry follows a real Juki / Brother lockstitch:
     · Head on the LEFT with the needle bar and presser foot
     · Arm extending right from the head
     · Body/pillar on the RIGHT with the mounted handwheel
     · Bed (machine base) sitting on the workbench top
     · 4-leg stand
     · Underbed motor + belt curving up to the handwheel pulley
     · LCD control panel on the arm front
     · Spool pole + thread cone rising from the back of the arm
     · Length ruler ticks along the bed front
     · Fabric pad + bobbin/hook circle under the presser foot
*/

const MachineMap = memo(function MachineMap({
  activeRegion,
}: {
  activeRegion: AxisRegion | null;
}) {
  const t = useT();
  const tl = useTL();
  /* v30: thinner, more consistent line weights for engineering-schematic
     quality. Idle strokes drop from 1.3 → 1.05; active drops from 2.2
     → 1.75 so the hover feedback stays visible without ever looking
     "bold-ed". Sub-detail lines (vents, belts, ruler ticks) inherit
     either the active or a 0.7-0.85 idle. */
  const sw = (region: AxisRegion, active = 1.75, idle = 1.05) =>
    activeRegion === region ? active : idle;

  /* Active-region fill helpers — solid parts get a subtle inverted fill
     when their axis is hot, idle parts get the surface token. */
  const bodyFill = (region: AxisRegion) =>
    activeRegion === region ? "var(--bg-surface-active)" : "var(--bg-surface)";

  return (
    <div className="w-full">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-3 overflow-hidden">
        <svg
          viewBox="0 0 800 520"
          className="w-full h-auto"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            color: "var(--text-primary)",
            transition: "stroke-width 180ms ease, fill 180ms ease",
          }}
          role="img"
          aria-label="Industrial lockstitch sewing machine technical schematic"
        >
          {/* ── Floor line ─────────────────────────────────────────── */}
          <line
            x1="20"
            y1="498"
            x2="780"
            y2="498"
            strokeWidth={0.8}
            opacity={0.35}
            fill="none"
          />

          {/* ── STAND legs ─────────────────────────────────────────── */}
          <g fill="none" strokeWidth={sw("bed", 2.4, 1.6)}>
            {[100, 280, 540, 720].map((x) => (
              <line key={x} x1={x} y1={400} x2={x} y2={494} />
            ))}
            {[100, 280, 540, 720].map((x) => (
              <line
                key={`foot-${x}`}
                x1={x - 12}
                y1={494}
                x2={x + 12}
                y2={494}
                strokeWidth={2}
              />
            ))}
            {/* Cross-brace between front legs */}
            <line x1={100} y1={460} x2={720} y2={460} strokeWidth={0.8} opacity={0.5} />
          </g>

          {/* ── TABLE top — workbench the machine sits on ─────────── */}
          <g strokeWidth={sw("bed")}>
            <rect
              x="30"
              y="370"
              width="740"
              height="30"
              rx="4"
              fill={bodyFill("bed")}
            />
            {/* Front lip seam */}
            <line
              x1="30"
              y1="388"
              x2="770"
              y2="388"
              strokeWidth={0.6}
              opacity={0.5}
              fill="none"
            />
          </g>

          {/* ── MOTOR + belt under the table ───────────────────────── */}
          <g strokeWidth={sw("motor")}>
            <rect
              x="300"
              y="408"
              width="160"
              height="58"
              rx="6"
              fill={bodyFill("motor")}
            />
            {/* Motor pulley */}
            <circle
              cx="380"
              cy="437"
              r="11"
              fill="var(--bg-surface-subtle)"
              strokeWidth={1.1}
            />
            <circle cx="380" cy="437" r="3" fill="currentColor" stroke="none" />
            {/* Belt curving from motor pulley up to the handwheel pulley */}
            <path
              d="M 388 428 Q 460 360 660 305"
              strokeWidth={1.2}
              fill="none"
              opacity={activeRegion === "motor" ? 1 : 0.7}
            />
            {/* Fan vents on motor side */}
            {[0, 1, 2, 3].map((i) => (
              <line
                key={i}
                x1="312"
                y1={420 + i * 9}
                x2="338"
                y2={420 + i * 9}
                strokeWidth={0.8}
                opacity={0.7}
                fill="none"
              />
            ))}
            {/* Power cable trailing off the motor */}
            <path
              d="M 460 460 Q 510 480 540 494"
              strokeWidth={1}
              fill="none"
              opacity={0.6}
            />
          </g>

          {/* ── BED — machine base on top of the table ─────────────── */}
          <g strokeWidth={sw("bed")}>
            <path
              d="M 70 315 L 670 315 Q 685 315 685 328 L 685 365 L 55 365 L 55 328 Q 55 315 70 315 Z"
              fill={bodyFill("bed")}
            />
            {/* Needle plate cutout */}
            <rect
              x="143"
              y="312"
              width="46"
              height="6"
              rx="1"
              strokeWidth={0.9}
              fill="var(--bg-surface-subtle)"
            />
            {/* Bobbin cover plate */}
            <ellipse
              cx="225"
              cy="335"
              rx="18"
              ry="5"
              strokeWidth={0.9}
              fill="var(--bg-surface-subtle)"
            />
          </g>

          {/* ── LENGTH ruler — tick marks along the front of the bed */}
          <g strokeWidth={sw("length")} fill="none">
            {[120, 200, 280, 360, 440, 520, 600, 660].map((x) => (
              <line key={x} x1={x} y1={365} x2={x} y2={355} />
            ))}
            <line
              x1="55"
              y1="365"
              x2="685"
              y2="365"
              strokeWidth={activeRegion === "length" ? 1.6 : 0.8}
              opacity={activeRegion === "length" ? 1 : 0.6}
            />
          </g>

          {/* ── HOOK / bobbin assembly below the needle plate ──────── */}
          <g strokeWidth={sw("hook")}>
            <circle
              cx="166"
              cy="395"
              r="16"
              fill={bodyFill("hook")}
            />
            <circle
              cx="166"
              cy="395"
              r="5"
              fill="currentColor"
              stroke="none"
            />
            <line
              x1="166"
              y1="365"
              x2="166"
              y2="379"
              strokeWidth={0.9}
              fill="none"
              opacity={0.6}
            />
          </g>

          {/* ── HEAD — left vertical block with the needle ──────────── */}
          <g strokeWidth={sw("head")}>
            <path
              d="M 110 315 L 110 165 Q 110 130 145 130 L 205 130 Q 240 130 240 165 L 240 315 Z"
              fill={bodyFill("head")}
            />
            {/* KOLEEX brand plate */}
            <rect
              x="128"
              y="220"
              width="94"
              height="28"
              rx="4"
              strokeWidth={1}
              fill="var(--bg-surface-subtle)"
            />
            <text
              x="175"
              y="238"
              textAnchor="middle"
              fontSize="11"
              fontFamily="ui-sans-serif, system-ui"
              fontWeight="700"
              fill="currentColor"
              stroke="none"
              style={{ letterSpacing: "0.14em" }}
            >
              KOLEEX
            </text>
            {/* Inspection oval */}
            <ellipse
              cx="175"
              cy="280"
              rx="9"
              ry="14"
              strokeWidth={0.8}
              fill="none"
              opacity={0.6}
            />
            {/* Tensioner disc on front of head */}
            <circle
              cx="195"
              cy="195"
              r="10"
              strokeWidth={1}
              fill="var(--bg-surface-subtle)"
            />
            <circle cx="195" cy="195" r="3" fill="currentColor" stroke="none" />
          </g>

          {/* ── NEEDLE BAR + presser foot under the head ───────────── */}
          <g strokeWidth={sw("head")}>
            <line x1="166" y1="315" x2="166" y2="338" strokeWidth={2.4} />
            <path
              d="M 156 338 L 176 338 L 172 350 L 160 350 Z"
              fill="currentColor"
              stroke="none"
            />
          </g>

          {/* ── FABRIC pad on the bed under the presser foot ──────── */}
          <g strokeWidth={sw("fabric")}>
            <path
              d="M 80 320 L 270 320 L 264 332 L 86 332 Z"
              fill={
                activeRegion === "fabric"
                  ? "var(--bg-surface-active)"
                  : "var(--bg-surface-subtle)"
              }
              opacity={activeRegion === "fabric" ? 1 : 0.7}
            />
          </g>

          {/* ── ARM — horizontal beam from head across to body ─────── */}
          <g strokeWidth={sw("head")}>
            <path
              d="M 240 150 L 600 150 Q 620 150 620 170 L 620 250 Q 620 268 600 268 L 240 268 Z"
              fill={bodyFill("head")}
            />
            {/* Brand stripe along the arm */}
            <line
              x1="262"
              y1="200"
              x2="600"
              y2="200"
              strokeWidth={0.6}
              opacity={0.4}
              fill="none"
            />
          </g>

          {/* ── BODY / right pillar — supports the handwheel ───────── */}
          <g strokeWidth={sw("head")}>
            <path
              d="M 600 150 L 660 150 Q 685 150 685 175 L 685 315 L 600 315 L 600 268 Q 620 268 620 250 L 620 170 Q 620 150 600 150 Z"
              fill={bodyFill("head")}
            />
          </g>

          {/* ── LCD CONTROL PANEL on the arm front (special config) ── */}
          <g strokeWidth={sw("special")}>
            <rect
              x="298"
              y="170"
              width="220"
              height="86"
              rx="6"
              fill={bodyFill("special")}
            />
            {/* Screen */}
            <rect
              x="310"
              y="180"
              width="198"
              height="40"
              rx="3"
              strokeWidth={1}
              fill="var(--bg-surface-subtle)"
            />
            <text
              x="324"
              y="207"
              fontSize="15"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fontWeight="700"
              fill="currentColor"
              stroke="none"
              style={{ letterSpacing: "0.06em" }}
            >
              XSL-Q10
            </text>
            <text
              x="450"
              y="207"
              fontSize="11"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill="currentColor"
              stroke="none"
              opacity={0.7}
            >
              READY
            </text>
            {/* Button row */}
            {[330, 366, 402, 438, 474].map((cx) => (
              <circle
                key={cx}
                cx={cx}
                cy="240"
                r="7.5"
                strokeWidth={0.9}
                fill="var(--bg-surface-subtle)"
              />
            ))}
            {/* S — big central button */}
            <text
              x="402"
              y="244"
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-sans-serif, system-ui"
              fontWeight="700"
              fill="currentColor"
              stroke="none"
            >
              S
            </text>
          </g>

          {/* ── HANDWHEEL — large circle protruding from the body ──── */}
          <g strokeWidth={sw("head")}>
            <circle
              cx="660"
              cy="305"
              r="48"
              fill={bodyFill("head")}
              strokeWidth={activeRegion === "head" ? 2.4 : 1.6}
            />
            <circle cx="660" cy="305" r="40" strokeWidth={0.7} fill="none" opacity={0.5} />
            <circle cx="660" cy="305" r="12" fill="currentColor" stroke="none" />
            {/* Spokes */}
            {[0, 30, 60, 90, 120, 150].map((deg) => {
              const a = (deg * Math.PI) / 180;
              const r1 = 14;
              const r2 = 40;
              const x1 = 660 + Math.cos(a) * r1;
              const y1 = 305 + Math.sin(a) * r1;
              const x2 = 660 + Math.cos(a) * r2;
              const y2 = 305 + Math.sin(a) * r2;
              return (
                <line
                  key={deg}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  strokeWidth={0.8}
                />
              );
            })}
          </g>

          {/* ── SPOOL stand on top of the arm ─────────────────────── */}
          <g strokeWidth={sw("head", 1.6, 1)}>
            {/* Pole */}
            <line x1="400" y1="150" x2="400" y2="40" strokeWidth={1.6} />
            {/* Top cap */}
            <circle cx="400" cy="40" r="4" fill="currentColor" stroke="none" />
            {/* Thread cone */}
            <path
              d="M 384 110 L 400 50 L 416 110 Z"
              fill="var(--bg-surface-subtle)"
              strokeWidth={1.1}
            />
            {/* Cone base ring */}
            <ellipse
              cx="400"
              cy="110"
              rx="18"
              ry="4.5"
              strokeWidth={0.8}
              fill="none"
            />
            {/* Secondary spool pole behind */}
            <line
              x1="438"
              y1="60"
              x2="438"
              y2="150"
              strokeWidth={1.1}
              opacity={0.55}
            />
            <circle
              cx="438"
              cy="60"
              r="3"
              strokeWidth={0.8}
              opacity={0.55}
              fill="none"
            />
            {/* Thread guide eyelet on the pole */}
            <circle
              cx="400"
              cy="130"
              r="3"
              strokeWidth={0.9}
              fill="none"
              opacity={0.7}
            />
          </g>

          {/* ── Region labels — only the active one is visible ─────── */}
          {activeRegion && (
            <g pointerEvents="none">
              <line
                x1={REGION_CALLOUT[activeRegion].fromX}
                y1={REGION_CALLOUT[activeRegion].fromY}
                x2={REGION_CALLOUT[activeRegion].toX}
                y2={REGION_CALLOUT[activeRegion].toY}
                strokeWidth={0.8}
                fill="none"
                opacity={0.7}
              />
              <circle
                cx={REGION_CALLOUT[activeRegion].fromX}
                cy={REGION_CALLOUT[activeRegion].fromY}
                r={3}
                fill="currentColor"
                stroke="none"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Caption strip */}
      <div className="mt-3 px-3 py-2 rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] text-center">
        {activeRegion ? (
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--text-primary)] font-mono">
            <span aria-hidden>◉</span> {tl(regionLabel(activeRegion))}
          </div>
        ) : (
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {t("builder.caption_default")}
          </div>
        )}
      </div>
    </div>
  );
});

/* Discriminated union for the axis-region mapping, declared once. */
type AxisRegion =
  | "head"
  | "motor"
  | "bed"
  | "length"
  | "fabric"
  | "hook"
  | "special";

/* Anchor points so the active-region callout dot lands on the right
   part of the machine without cluttering the SVG body. */
const REGION_CALLOUT: Record<
  AxisRegion,
  { fromX: number; fromY: number; toX: number; toY: number }
> = {
  head: { fromX: 175, fromY: 200, toX: 175, toY: 200 },
  motor: { fromX: 380, fromY: 437, toX: 380, toY: 437 },
  bed: { fromX: 400, fromY: 340, toX: 400, toY: 340 },
  length: { fromX: 440, fromY: 365, toX: 440, toY: 365 },
  fabric: { fromX: 170, fromY: 326, toX: 170, toY: 326 },
  hook: { fromX: 166, fromY: 395, toX: 166, toY: 395 },
  special: { fromX: 408, fromY: 213, toX: 408, toY: 213 },
};

function regionLabel(r: AxisRegion): string {
  switch (r) {
    case "head":
      return "MACHINE HEAD";
    case "motor":
      return "MOTOR";
    case "bed":
      return "BED / TABLE";
    case "length":
      return "OPERATION LENGTH";
    case "fabric":
      return "FABRIC PAD";
    case "hook":
      return "HOOK / BOBBIN";
    case "special":
      return "CONTROL PANEL";
  }
}
