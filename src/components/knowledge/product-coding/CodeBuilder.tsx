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
  activeRegion: "head" | "motor" | "bed" | "length" | "fabric" | "hook" | "special" | null;
}) {
  const baseStroke = "var(--border-subtle)";
  const activeStroke = "var(--text-primary)";

  function stroke(region: typeof activeRegion) {
    return activeRegion === region ? activeStroke : baseStroke;
  }
  function strokeWidth(region: typeof activeRegion) {
    return activeRegion === region ? 1.6 : 1;
  }

  return (
    <svg
      viewBox="0 0 240 140"
      className="w-full max-w-[240px]"
      style={{ color: "var(--text-primary)" }}
    >
      {/* Bed / workbench (long horizontal — controlled by Length + Bed type) */}
      <rect
        x="10"
        y="92"
        width="220"
        height="14"
        rx="2"
        fill="none"
        stroke={
          activeRegion === "length" || activeRegion === "bed"
            ? activeStroke
            : baseStroke
        }
        strokeWidth={
          activeRegion === "length" || activeRegion === "bed" ? 1.8 : 1
        }
      />
      {/* Length tick marks under the bed */}
      {[20, 60, 100, 140, 180, 220].map((x) => (
        <line
          key={x}
          x1={x}
          y1={106}
          x2={x}
          y2={111}
          stroke={activeRegion === "length" ? activeStroke : baseStroke}
          strokeWidth={1}
        />
      ))}

      {/* Head — main body */}
      <rect
        x="50"
        y="30"
        width="120"
        height="50"
        rx="6"
        fill="none"
        stroke={stroke("head")}
        strokeWidth={strokeWidth("head")}
      />
      {/* Head arm */}
      <rect
        x="120"
        y="32"
        width="48"
        height="20"
        rx="3"
        fill="none"
        stroke={stroke("head")}
        strokeWidth={strokeWidth("head")}
      />
      {/* Needle bar drop */}
      <line
        x1="160"
        y1="50"
        x2="160"
        y2="88"
        stroke={stroke("head")}
        strokeWidth={strokeWidth("head")}
      />
      <line
        x1="156"
        y1="82"
        x2="164"
        y2="82"
        stroke={stroke("head")}
        strokeWidth={strokeWidth("head")}
      />

      {/* Motor — left of head */}
      <circle
        cx="38"
        cy="55"
        r="13"
        fill="none"
        stroke={stroke("motor")}
        strokeWidth={strokeWidth("motor")}
      />
      <circle
        cx="38"
        cy="55"
        r="5"
        fill={activeRegion === "motor" ? activeStroke : "none"}
        stroke={stroke("motor")}
        strokeWidth={1}
      />
      <line
        x1="51"
        y1="55"
        x2="60"
        y2="55"
        stroke={stroke("motor")}
        strokeWidth={strokeWidth("motor")}
      />

      {/* Hook — small ring just below the needle drop */}
      <circle
        cx="160"
        cy="96"
        r="5"
        fill={activeRegion === "hook" ? activeStroke : "none"}
        stroke={stroke("hook")}
        strokeWidth={strokeWidth("hook")}
      />

      {/* Fabric pad — under the bed, left of needle */}
      <rect
        x="100"
        y="86"
        width="50"
        height="6"
        rx="1"
        fill={activeRegion === "fabric" ? activeStroke : "none"}
        stroke={stroke("fabric")}
        strokeWidth={strokeWidth("fabric")}
      />

      {/* Special accessories rail — right side of bed */}
      <line
        x1="195"
        y1="86"
        x2="225"
        y2="86"
        stroke={stroke("special")}
        strokeWidth={strokeWidth("special")}
        strokeDasharray={activeRegion === "special" ? "0" : "3,2"}
      />
      <rect
        x="200"
        y="80"
        width="20"
        height="6"
        rx="1"
        fill="none"
        stroke={stroke("special")}
        strokeWidth={strokeWidth("special")}
      />

      {/* Footer caption labels — only the active region's label shows */}
      {activeRegion && (
        <text
          x="120"
          y="130"
          textAnchor="middle"
          fontSize="9"
          fill={activeStroke}
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          style={{ letterSpacing: "0.12em" }}
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
