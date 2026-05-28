"use client";

/* ---------------------------------------------------------------------------
   AIParseFlow — visualizes what the assistant understands when handed
   a technical product code. The technical identity at the top is parsed
   into six derived facts shown as small terminals below, then an output
   strip lists what the downstream consumers receive (recommendation,
   BOM resolution, spare-parts match, compatible accessories, auto-
   quotation surcharges). No connection lines are drawn — the numbered
   circles + matching axis index on each fact card carry the mapping.
   --------------------------------------------------------------------------- */

import { HubIcon } from "./icon-registry";
import { useT } from "./i18n";
import { HeaderShell } from "./primitives";

const FACTS: Array<{
  axis: number;
  segment: string;
  labelKey: string;
  detailKey: string;
}> = [
  { axis: 1, segment: "Q10", labelKey: "ai.fact.cat.label", detailKey: "ai.fact.cat.detail" },
  { axis: 2, segment: "5", labelKey: "ai.fact.auto.label", detailKey: "ai.fact.auto.detail" },
  { axis: 4, segment: "E", labelKey: "ai.fact.motor.label", detailKey: "ai.fact.motor.detail" },
  { axis: 5, segment: "560", labelKey: "ai.fact.length.label", detailKey: "ai.fact.length.detail" },
  { axis: 6, segment: "M", labelKey: "ai.fact.fabric.label", detailKey: "ai.fact.fabric.detail" },
  { axis: 7, segment: "HJ", labelKey: "ai.fact.hook.label", detailKey: "ai.fact.hook.detail" },
];

export default function AIParseFlow() {
  const t = useT();
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Code input at top — unified HeaderShell grammar */}
      <HeaderShell
        eyebrow={
          <>
            <HubIcon domain="utility" k="cpu" size={13} />
            {t("ai.input_eyebrow")}
          </>
        }
        primary={
          <div
            className="font-mono text-[20px] sm:text-[24px] font-bold tracking-wider text-[var(--text-primary)]"
            dir="ltr"
          >
            XSL-Q10-5-E-560-M-HJ
          </div>
        }
        trailing={
          <div className="text-[10.5px] text-[var(--text-faint)] max-w-sm leading-relaxed">
            {t("ai.input_lead")}
          </div>
        }
      />

      {/* Six derived facts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-5 sm:p-7">
        {FACTS.map((f) => (
          <div
            key={f.axis}
            className="relative rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] p-4 overflow-hidden"
          >
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-subtle)] to-transparent"
            />
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] text-[10px] font-bold leading-none"
                  dir="ltr"
                >
                  {f.axis}
                </div>
                <div
                  className="font-mono text-[11.5px] font-bold tracking-wider text-[var(--text-primary)]"
                  dir="ltr"
                >
                  {f.segment}
                </div>
              </div>
              <div
                className="text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--text-faint)]"
                dir="ltr"
              >
                {String(f.axis).padStart(2, "0")}
              </div>
            </div>
            <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">
              {t(f.labelKey)}
            </div>
            <div className="mt-1 text-[11px] text-[var(--text-faint)] leading-snug">
              {t(f.detailKey)}
            </div>
          </div>
        ))}
      </div>

      {/* Footer: output */}
      <div className="px-5 sm:px-7 py-4 border-t border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] text-[11px] text-[var(--text-faint)] flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[var(--text-primary)] font-semibold">{t("ai.output_label")}</span>
        <span>{t("ai.output.recommendation")}</span>
        <span aria-hidden>·</span>
        <span>{t("ai.output.bom")}</span>
        <span aria-hidden>·</span>
        <span>{t("ai.output.spare")}</span>
        <span aria-hidden>·</span>
        <span>{t("ai.output.acc")}</span>
        <span aria-hidden>·</span>
        <span>{t("ai.output.surcharge")}</span>
      </div>
    </div>
  );
}
