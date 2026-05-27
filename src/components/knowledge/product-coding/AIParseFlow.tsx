"use client";

/* ---------------------------------------------------------------------------
   AIParseFlow — visualizes what the assistant understands when handed
   a technical product code.

   Layout: code at the top, six derived facts laid out as terminals
   below, faint connection lines drawn from the matching segment of
   the code to each fact.
   --------------------------------------------------------------------------- */

import { HubIcon } from "./icon-registry";

const FACTS: Array<{
  axis: number;
  segment: string;
  label: string;
  detail: string;
}> = [
  { axis: 1, segment: "Q10", label: "Machine category", detail: "Single-needle lockstitch · new-model line" },
  { axis: 2, segment: "5", label: "Automation level", detail: "Single stepper · auto thread-trim ready" },
  { axis: 4, segment: "E", label: "Motor type", detail: "Direct-drive servo · 550 W class" },
  { axis: 5, segment: "560", label: "Operation length", detail: "Long-arm workspace · 560 mm bed" },
  { axis: 6, segment: "M", label: "Fabric tier", detail: "Medium-weight woven · trousers / jackets" },
  { axis: 7, segment: "HJ", label: "Hook system", detail: "DLC hook · low-friction · BOM bucket 7-HJ" },
];

export default function AIParseFlow() {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Code input at top */}
      <div
        className="px-5 sm:px-7 py-5 border-b border-[var(--border-faint)] flex flex-wrap items-baseline gap-4 justify-between"
        style={{
          background:
            "linear-gradient(180deg, var(--bg-surface) 0%, var(--bg-secondary) 100%)",
        }}
      >
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)] flex items-center gap-2">
            <HubIcon domain="utility" k="cpu" size={13} />
            AI input · technical identity
          </div>
          <div className="mt-2 font-mono text-[20px] sm:text-[24px] font-bold tracking-wider text-[var(--text-primary)]">
            XSL-Q10-5-E-560-M-HJ
          </div>
        </div>
        <div className="text-[10.5px] text-[var(--text-faint)] max-w-sm leading-relaxed">
          The assistant treats the code as a feature vector. Each axis
          contributes one fact to the answer.
        </div>
      </div>

      {/* Six derived facts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5 sm:p-7">
        {FACTS.map((f) => (
          <div
            key={f.axis}
            className="relative rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-4 overflow-hidden"
          >
            {/* Subtle inset highlight for depth */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent"
            />
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold leading-none">
                  {f.axis}
                </div>
                <div className="font-mono text-[11.5px] font-bold tracking-wider text-[var(--text-primary)]">
                  {f.segment}
                </div>
              </div>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--text-faint)]">
                {String(f.axis).padStart(2, "0")}
              </div>
            </div>
            <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">
              {f.label}
            </div>
            <div className="mt-1 text-[11px] text-[var(--text-faint)] leading-snug">
              {f.detail}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: output */}
      <div className="px-5 sm:px-7 py-4 border-t border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] text-[11px] text-[var(--text-faint)] flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[var(--text-primary)] font-semibold">Output:</span>
        <span>recommendation</span>
        <span aria-hidden>·</span>
        <span>BOM resolution</span>
        <span aria-hidden>·</span>
        <span>spare-parts match</span>
        <span aria-hidden>·</span>
        <span>compatible accessories</span>
        <span aria-hidden>·</span>
        <span>auto-quotation surcharges</span>
      </div>
    </div>
  );
}
