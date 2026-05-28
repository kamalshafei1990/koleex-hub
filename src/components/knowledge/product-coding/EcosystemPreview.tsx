"use client";

/* ---------------------------------------------------------------------------
   EcosystemPreview — v30.

   Below the DivisionStrip in §01. Shows that every division will
   inherit the same coding grammar by previewing illustrative future
   codes for the divisions outside Garment Machinery.

   Pure illustrative content — the codes here are not canonical yet.
   The point is to make the system feel future-scale and unified.
   --------------------------------------------------------------------------- */

import { useT, useTL } from "./i18n";
import { taxonomyLogoUrl } from "./taxonomy-logo";

type Preview = {
  divisionId: string;
  divisionLabel: string;
  prefix: string;
  exampleCode: string;
  status: "live" | "in_design" | "planned";
  capabilities: Array<"ai" | "erp" | "compat">;
};

const PREVIEWS: Preview[] = [
  {
    divisionId: "garment-machinery",
    divisionLabel: "Garment Machinery",
    prefix: "X",
    exampleCode: "XSL-Q10-5-E-560-M",
    status: "live",
    capabilities: ["ai", "erp", "compat"],
  },
  {
    divisionId: "smart-living",
    divisionLabel: "Smart Living",
    prefix: "K",
    exampleCode: "KSL-HM-220-AI",
    status: "in_design",
    capabilities: ["ai", "erp", "compat"],
  },
  {
    divisionId: "mobility",
    divisionLabel: "Mobility",
    prefix: "M",
    exampleCode: "KMB-EV-550-X",
    status: "in_design",
    capabilities: ["ai", "erp"],
  },
  {
    divisionId: "medical",
    divisionLabel: "Medical",
    prefix: "MD",
    exampleCode: "KMD-DV-110-S",
    status: "planned",
    capabilities: ["ai", "erp", "compat"],
  },
  {
    divisionId: "energy",
    divisionLabel: "Energy",
    prefix: "E",
    exampleCode: "KEN-PV-450-G",
    status: "planned",
    capabilities: ["erp", "compat"],
  },
  {
    divisionId: "digital-devices",
    divisionLabel: "Digital Devices",
    prefix: "D",
    exampleCode: "KDD-PH-512-X",
    status: "planned",
    capabilities: ["ai", "erp"],
  },
];

function StatusPill({ status, t }: { status: Preview["status"]; t: (k: string) => string }) {
  const map = {
    live: {
      key: "eco.status.live",
      cls: "border-[var(--text-primary)] text-[var(--text-primary)]",
    },
    in_design: {
      key: "eco.status.in_design",
      cls: "border-[var(--border-subtle)] text-[var(--text-primary)] bg-[var(--bg-surface-subtle)]",
    },
    planned: {
      key: "eco.status.planned",
      cls: "border-dashed border-[var(--border-subtle)] text-[var(--text-faint)]",
    },
  } as const;
  const m = map[status];
  return (
    <span
      className={`text-[9.5px] font-bold uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-sm border ${m.cls}`}
    >
      {t(m.key)}
    </span>
  );
}

function DivisionGlyph({ slug, label }: { slug: string; label: string }) {
  const url = taxonomyLogoUrl("divisions", slug);
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={label} width={26} height={26} style={{ width: 26, height: 26 }} />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-dim)]" aria-hidden />
      )}
    </div>
  );
}

export default function EcosystemPreview() {
  const t = useT();
  const tl = useTL();

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[var(--text-faint)]">
            {t("eco.eyebrow")}
          </div>
          <h3 className="mt-1 text-[18px] sm:text-[20px] font-semibold tracking-tight text-[var(--text-primary)]">
            {t("eco.title")}
          </h3>
          <p className="mt-1.5 text-[12.5px] text-[var(--text-faint)] leading-relaxed max-w-3xl">
            {t("eco.sub")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PREVIEWS.map((p) => (
          <div
            key={p.divisionId}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4"
          >
            {/* Header — glyph + label + status */}
            <div className="flex items-center gap-3 mb-3">
              <DivisionGlyph slug={p.divisionId} label={tl(p.divisionLabel)} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-[var(--text-primary)] truncate">
                  {tl(p.divisionLabel)}
                </div>
                <div
                  className="text-[10.5px] font-mono text-[var(--text-faint)] mt-0.5"
                  dir="ltr"
                >
                  {p.prefix}
                </div>
              </div>
              <StatusPill status={p.status} t={t} />
            </div>

            {/* Preview code */}
            <div className="rounded-md border border-[var(--border-faint)] bg-[var(--bg-surface-subtle)] px-3 py-2 mb-3">
              <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--text-faint)] mb-1">
                {t("eco.preview_code")}
              </div>
              <div
                className="font-mono text-[13px] font-bold tracking-[0.06em] text-[var(--text-primary)]"
                dir="ltr"
              >
                {p.exampleCode}
              </div>
            </div>

            {/* Capability chips */}
            <div className="flex flex-wrap gap-1">
              {p.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-[9.5px] font-medium text-[var(--text-faint)] border border-[var(--border-faint)] rounded-sm px-1.5 py-0.5"
                >
                  {t(`eco.capability.${cap}`)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
