"use client";

/* ---------------------------------------------------------------------------
   EcosystemMap — node-based future-expansion diagram.

   A single SVG-driven layout: one central "KOLEEX Coding Grammar" node
   connected to six division nodes by faint engineering pathways. The
   division cards are positioned inside an absolutely-positioned grid
   so the SVG paths underneath connect their visual centers naturally.

   Monochrome, single stroke color (currentColor), no animations on the
   paths themselves — the structure does the talking.
   --------------------------------------------------------------------------- */

import { DIVISIONS } from "./data";
import { HubIcon } from "./icon-registry";

const NODE_SLOTS = [
  { id: "garment", row: 0, col: 0 },
  { id: "smart-devices", row: 0, col: 2 },
  { id: "smart-home", row: 1, col: 2 },
  { id: "automation", row: 2, col: 2 },
  { id: "vehicles", row: 2, col: 0 },
  { id: "technology", row: 1, col: 0 },
] as const;

export default function EcosystemMap() {
  return (
    <div
      className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 50%, var(--bg-surface) 0%, var(--bg-secondary) 70%)",
      }}
    >
      {/* Faint engineering grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage:
            "radial-gradient(80% 60% at 50% 50%, black 40%, transparent 100%)",
        }}
      />

      {/* SVG connections behind the cards */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ color: "var(--text-dim)" }}
      >
        {/* Hub center at (50, 50). Six lines outwards. */}
        {[
          [50, 50, 16, 16],   // garment (top-left)
          [50, 50, 84, 16],   // smart-devices (top-right)
          [50, 50, 84, 50],   // smart-home (right)
          [50, 50, 84, 84],   // automation (bottom-right)
          [50, 50, 16, 84],   // vehicles (bottom-left)
          [50, 50, 16, 50],   // technology (left)
        ].map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="0.18"
            strokeDasharray="0.6 0.6"
          />
        ))}
        {/* Center pulse circle */}
        <circle
          cx="50"
          cy="50"
          r="1.2"
          fill="currentColor"
          opacity="0.7"
        />
        <circle
          cx="50"
          cy="50"
          r="3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.16"
          opacity="0.5"
        />
      </svg>

      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3 p-5 sm:p-7">
        {/* Top row */}
        <DivisionNode id="garment" />
        <CenterHub />
        <DivisionNode id="smart-devices" />

        {/* Middle row */}
        <DivisionNode id="technology" />
        <Spacer />
        <DivisionNode id="smart-home" />

        {/* Bottom row */}
        <DivisionNode id="vehicles" />
        <Spacer />
        <DivisionNode id="automation" />
      </div>
    </div>
  );
}

function CenterHub() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        {/* Soft halo */}
        <div
          aria-hidden
          className="absolute inset-0 -m-4 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.08), transparent)",
          }}
        />
        <div className="relative h-28 w-28 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex flex-col items-center justify-center text-center px-3">
          <HubIcon
            domain="utility"
            k="cpu"
            size={18}
            className="text-[var(--text-primary)]"
          />
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-primary)] leading-tight">
            KOLEEX
          </div>
          <div className="text-[9px] text-[var(--text-faint)] leading-tight mt-0.5">
            Coding Grammar
          </div>
        </div>
      </div>
    </div>
  );
}

function Spacer() {
  return <div className="hidden md:block" />;
}

function DivisionNode({ id }: { id: string }) {
  const d = DIVISIONS.find((x) => x.id === id);
  if (!d) return null;
  const live = d.status === "live";
  return (
    <div className="relative rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] backdrop-blur-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
            <HubIcon domain="division" k={d.id} size={13} />
          </div>
          <div className="font-mono text-[13px] font-bold tracking-wider text-[var(--text-primary)]">
            {d.prefix}
          </div>
        </div>
        <div
          className={`text-[9px] font-bold uppercase tracking-[0.18em] px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
            live
              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-300"
              : "border-[var(--border-subtle)] text-[var(--text-faint)]"
          }`}
        >
          {live && (
            <span
              aria-hidden
              className="h-1 w-1 rounded-full bg-emerald-500"
            />
          )}
          {live ? "Live" : "Planned"}
        </div>
      </div>
      <div className="mt-2 text-[12.5px] font-semibold text-[var(--text-primary)]">
        {d.name}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--text-faint)] leading-snug">
        {d.description}
      </div>
    </div>
  );
}
