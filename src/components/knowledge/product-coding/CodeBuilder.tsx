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
          <MachineSilhouette
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

/* ── Minimal sewing-machine silhouette ──────────────────────────────────
   Single SVG, all strokes use currentColor so theme inheritance works
   without per-region tinting. Active region gets stroke-width:2 + a
   soft glow filter. */

function MachineSilhouette({
  activeRegion,
}: {
  activeRegion:
    | "head"
    | "motor"
    | "bed"
    | "length"
    | "fabric"
    | "hook"
    | "special"
    | null;
}) {
  const baseStroke = "var(--border-subtle)";
  const activeStroke = "var(--text-primary)";

  /* Helpers — return the right stroke + width for each region so we
     don't repeat the conditional 30 times below. */
  const sw = (region: typeof activeRegion, active = 1.8, idle = 1) =>
    activeRegion === region ? active : idle;
  const st = (region: typeof activeRegion) =>
    activeRegion === region ? activeStroke : baseStroke;

  return (
    <svg
      viewBox="0 0 300 220"
      className="w-full max-w-[300px]"
      style={{ color: "var(--text-primary)" }}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* ─────────────────────────────────────────────────────────────
         INDUSTRIAL LOCKSTITCH — proper proportions.
         · Long bed across the bottom (the workbench)
         · Tall head on the LEFT with the spool tower above
         · Horizontal arm extending RIGHT, ending in the needle drop
         · Servo motor mounted UNDER the bed (with cable)
         · Hand wheel on the head's right side
         ───────────────────────────────────────────────────────────── */}

      {/* Spool stand — the thread tower on top */}
      <g stroke={st("head")} strokeWidth={sw("head")}>
        <line x1="60" y1="10" x2="60" y2="44" />
        <circle cx="60" cy="10" r="2.5" />
        {/* Thread cone */}
        <path d="M 56 22 L 60 14 L 64 22 L 56 22 Z" />
      </g>

      {/* HEAD — main vertical body (left), with the curved top profile
         characteristic of industrial sewing machines. */}
      <g stroke={st("head")} strokeWidth={sw("head")}>
        <path
          d="
            M 30 130
            L 30 78
            Q 30 60 48 60
            L 78 60
            Q 88 60 88 70
            L 88 130
            Z
          "
        />
        {/* Brand stripe across the head */}
        <line x1="38" y1="98" x2="80" y2="98" strokeWidth={0.6} />
      </g>

      {/* ARM — extends right from the head, ends just above the needle */}
      <g stroke={st("head")} strokeWidth={sw("head")}>
        <path
          d="
            M 88 72
            L 220 72
            Q 232 72 232 84
            L 232 110
            L 218 110
            L 218 84
            L 88 84
            Z
          "
        />
      </g>

      {/* Needle bar drop — vertical rod from arm down to bed */}
      <g stroke={st("head")} strokeWidth={sw("head")}>
        <line x1="225" y1="110" x2="225" y2="148" />
        {/* Presser foot pad */}
        <rect x="219" y="147" width="14" height="3.5" rx="0.5" />
      </g>

      {/* HANDWHEEL — characteristic circle on the right side of the head */}
      <g stroke={st("head")} strokeWidth={sw("head")}>
        <circle cx="88" cy="100" r="10" />
        <circle cx="88" cy="100" r="3" fill={st("head")} />
        <line x1="88" y1="90" x2="88" y2="110" strokeWidth={0.6} />
        <line x1="78" y1="100" x2="98" y2="100" strokeWidth={0.6} />
      </g>

      {/* BED — long horizontal work surface */}
      <g stroke={st("bed")} strokeWidth={sw("bed")}>
        <path
          d="
            M 18 152
            L 282 152
            L 282 168
            L 18 168
            Z
          "
        />
        {/* The bed slot / needle plate cutout */}
        <rect x="218" y="153" width="14" height="6" rx="0.5" />
      </g>

      {/* LENGTH ruler — tick marks underneath the bed, highlight when
         the "operation length" axis is active. */}
      <g stroke={st("length")} strokeWidth={sw("length", 1.2, 0.8)}>
        {[40, 90, 140, 190, 240].map((x) => (
          <line key={x} x1={x} y1="168" x2={x} y2="174" />
        ))}
        <line x1="40" y1="174" x2="240" y2="174" />
      </g>

      {/* MOTOR — direct-drive servo, mounted at the back of the head
         (industrial machines have the motor at the rear, not below). */}
      <g stroke={st("motor")} strokeWidth={sw("motor")}>
        <rect x="6" y="86" width="24" height="36" rx="3" />
        <circle cx="18" cy="104" r="6" />
        {/* fan vent slots */}
        <line x1="10" y1="93" x2="26" y2="93" strokeWidth={0.6} />
        <line x1="10" y1="116" x2="26" y2="116" strokeWidth={0.6} />
        {/* power cable */}
        <path d="M 18 122 Q 18 138 8 142" strokeWidth={0.8} />
      </g>

      {/* FABRIC — small folded square sitting under the presser foot */}
      <g stroke={st("fabric")} strokeWidth={sw("fabric")}>
        <path
          d="M 200 152 L 216 145 L 226 148 L 224 152 Z"
          fill={
            activeRegion === "fabric" ? activeStroke : "transparent"
          }
          opacity={activeRegion === "fabric" ? 0.18 : 1}
        />
        <line x1="206" y1="148" x2="220" y2="147" strokeWidth={0.6} />
      </g>

      {/* HOOK — bobbin/rotary hook under the bed, just below the needle */}
      <g stroke={st("hook")} strokeWidth={sw("hook")}>
        <circle cx="225" cy="180" r="9" />
        <circle cx="225" cy="180" r="3" />
        <line x1="225" y1="168" x2="225" y2="172" strokeWidth={0.6} />
      </g>

      {/* SPECIAL — accessory rail at the right edge of the bed
         (puller / folder / etc clip on here). */}
      <g stroke={st("special")} strokeWidth={sw("special")}>
        <line
          x1="248"
          y1="148"
          x2="278"
          y2="148"
          strokeDasharray={activeRegion === "special" ? "0" : "3 2"}
        />
        <rect x="252" y="139" width="22" height="9" rx="1.5" />
        <line x1="258" y1="143" x2="270" y2="143" strokeWidth={0.6} />
      </g>

      {/* Footer caption — only shows when a region is active */}
      {activeRegion && (
        <text
          x="150"
          y="208"
          textAnchor="middle"
          fontSize="9.5"
          fill={activeStroke}
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          style={{ letterSpacing: "0.14em" }}
        >
          {regionLabel(activeRegion)}
        </text>
      )}
    </svg>
  );
}

function regionLabel(r: NonNullable<Parameters<typeof MachineSilhouette>[0]["activeRegion"]>): string {
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
