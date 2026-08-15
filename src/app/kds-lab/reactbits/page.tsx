"use client";

/* KDS LAB — React Bits candidates, shown before anything is adopted.
   ---------------------------------------------------------------------------
   The owner asked to see these before they go anywhere near a real screen, so
   this route is the whole delivery: NOTHING here is imported by any app.

   Everything is shown AGAINST what the Hub already does, because "does it look
   nice" is the wrong question — the right one is "does it beat the thing we
   already have". Four of the five sections are a side-by-side for exactly that
   reason, and one of them (the progressive edge) is included only to show that
   we already win it.

   Vendored under components/vendor/reactbits with the licence beside it:
   MIT + Commons Clause, Copyright (c) 2026 David Haz. */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import CountUp from "@/components/vendor/CountUp";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });
const GlassSurface = dynamic(() => import("@/components/vendor/reactbits/GlassSurface.jsx"), { ssr: false });
const SpotlightCard = dynamic(() => import("@/components/vendor/reactbits/SpotlightCard.jsx"), { ssr: false });
const GlareHover = dynamic(() => import("@/components/vendor/reactbits/GlareHover.jsx"), { ssr: false });
const StarBorder = dynamic(() => import("@/components/vendor/reactbits/StarBorder.jsx"), { ssr: false });

function Section({ n, title, verdict, note, children }: {
  n: string; title: string; verdict: "keep" | "risky" | "have-it" | "maybe"; note: string; children: React.ReactNode;
}) {
  const tone = {
    keep: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
    maybe: "text-sky-300 border-sky-400/30 bg-sky-400/10",
    risky: "text-amber-300 border-amber-400/30 bg-amber-400/10",
    "have-it": "text-[var(--text-dim)] border-[var(--border-subtle)] bg-white/5",
  }[verdict];
  const label = { keep: "worth it", maybe: "try it", risky: "risky", "have-it": "we already have this" }[verdict];
  return (
    <section className="kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 md:p-6">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="text-[11px] text-[var(--text-dim)] tabular-nums mt-1">{n}</span>
        <h2 className="text-[15px] font-bold text-[var(--text-primary)]">{title}</h2>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tone}`}>{label}</span>
      </div>
      <p className="text-[12px] text-[var(--text-dim)] mt-1 mb-4 max-w-[70ch]">{note}</p>
      {children}
    </section>
  );
}

/** The Hub's own card, so every comparison is against the real thing. */
function OurCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`kx-glass rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 ${className}`}>
      {children}
    </div>
  );
}

const CARD = (
  <div className="text-[var(--text-primary)]">
    <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">Outstanding</div>
    <div className="text-[22px] font-bold mt-0.5">USD 48,250</div>
    <div className="text-[11px] text-[var(--text-dim)] mt-1">12 invoices · 3 overdue</div>
  </div>
);

export default function ReactBitsLab() {
  const [kpi, setKpi] = useState(0);
  /* Same detection GlassSurface does internally, surfaced so the verdict is
     visible rather than inferred from whether it "looks right". A lazy
     initialiser, not an effect: the answer never changes, so writing it back
     as state after paint is a second render for a constant. */
  const [svgOk] = useState<boolean | null>(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.style.backdropFilter = "url(#x)";
    return el.style.backdropFilter !== "";
  });

  useEffect(() => {
    const t = setTimeout(() => setKpi(48250), 400);   // so the counter has something to count TO
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="kx-app relative min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden><WavyBackground topLight /></div>

      <div className="relative z-[1] max-w-[1100px] mx-auto px-4 md:px-6 py-8 space-y-4">
        <header className="mb-2">
          <h1 className="text-[22px] font-bold">React Bits — candidates</h1>
          <p className="text-[12px] text-[var(--text-dim)] mt-1 max-w-[70ch]">
            Five of 113. Nothing here is wired into any app. Each is shown next to what the Hub
            already does, because the question is not whether it looks nice — it is whether it
            beats what we have.
          </p>
        </header>

        {/* 1 ── GlassSurface */}
        <Section
          n="01" title="GlassSurface — refraction, not blur" verdict="risky"
          note={`The only genuinely new capability in the library. Ours blurs and saturates what is behind it; this BENDS it, with an SVG displacement map — the "liquid glass" look. Cost: SVG filters are expensive, backdrop support for feImage is uneven, and it takes FIXED PIXEL dimensions — it will not size itself to a fluid card, which is most of our layout. Browser check below.`}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-[var(--text-dim)] mb-1.5">Ours — .kx-glass (54 files)</div>
              <OurCard>{CARD}</OurCard>
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-dim)] mb-1.5">Theirs — GlassSurface</div>
              <GlassSurface width={320} height={116} borderRadius={16} displace={2} distortionScale={-140} redOffset={2} greenOffset={8} blueOffset={14} brightness={55} opacity={0.9} blur={12}>
                <div className="p-4 w-full">{CARD}</div>
              </GlassSurface>
            </div>
          </div>
          <p className="text-[11px] mt-3 text-[var(--text-dim)]">
            This browser supports backdrop SVG filters:{" "}
            <b className={svgOk ? "text-emerald-300" : "text-amber-300"}>
              {svgOk === null ? "checking…" : svgOk ? "yes" : "NO — it falls back to a plain tint"}
            </b>
          </p>
        </Section>

        {/* 2 ── SpotlightCard */}
        <Section
          n="02" title="SpotlightCard — the cursor lights the card" verdict="maybe"
          note="24 lines, zero dependency: it writes the pointer position into two CSS variables and a radial gradient follows. Move the cursor across both to compare."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-[var(--text-dim)] mb-1.5">Ours — flat hover</div>
              <OurCard className="transition-colors hover:border-[var(--border-strong)]">{CARD}</OurCard>
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-dim)] mb-1.5">Theirs — SpotlightCard</div>
              <SpotlightCard spotlightColor="rgba(86,127,178,0.35)">{CARD}</SpotlightCard>
            </div>
          </div>
        </Section>

        {/* 3 ── GlareHover + StarBorder */}
        <Section
          n="03" title="GlareHover and StarBorder — two small hover marks" verdict="maybe"
          note="55 and 40 lines, no dependency. A sheen that crosses on hover, and a border that keeps moving. We already have .kx-ai-glow as the standing mark for AI actions, so the honest question is whether a SECOND mark earns its place."
        >
          <div className="flex flex-wrap gap-4 items-center">
            <GlareHover width="200px" height="72px" background="var(--bg-secondary)" borderRadius="14px" borderColor="var(--border-subtle)" glareColor="#BCD8F0" glareOpacity={0.25}>
              <span className="text-[13px] text-[var(--text-primary)]">Glare on hover</span>
            </GlareHover>
            <StarBorder color="#567FB2" speed="4s"><span className="text-[13px]">Star border</span></StarBorder>
            <button className="kx-ai-glow rounded-xl px-4 h-[44px] text-[13px] border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
              Ours — .kx-ai-glow
            </button>
          </div>
        </Section>

        {/* 4 ── CountUp */}
        <Section
          n="04" title="CountUp — rewritten, not adopted" verdict="keep"
          note="Theirs is 101 lines and pulls in framer-motion. The Hub has no animation library at all, and one ticking number is not a reason to acquire the first one — so this is the same idea on rAF in a third of the code, honouring reduced-motion and landing on the exact value. KpiCard is in 24 files and has nothing like it."
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] text-[var(--text-dim)] mb-1.5">Ours today — the number just appears</div>
              <OurCard>
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">Outstanding</div>
                <div className="text-[22px] font-bold mt-0.5 tabular-nums">USD 48,250</div>
              </OurCard>
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-dim)] mb-1.5">With CountUp (no dependency)</div>
              <OurCard>
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">Outstanding</div>
                <div className="text-[22px] font-bold mt-0.5">
                  <CountUp value={kpi} prefix="USD " />
                </div>
              </OurCard>
              <button
                onClick={() => setKpi((v) => (v === 48250 ? 61980 : 48250))}
                className="mt-2 text-[11px] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
              >
                Change the value
              </button>
            </div>
          </div>
        </Section>

        {/* 5 ── GradualBlur */}
        <Section
          n="05" title="GradualBlur — we already win this one" verdict="have-it"
          note="Their progressive edge is layered backdrop-filter under a mask. That is exactly what kx-bar-prog already does, with four stacked layers at 3/7/14/28px, tuned on this Hub and signed off. Included so the comparison is on the record rather than assumed — nothing to take."
        >
          <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden h-[110px] relative kx-bar-host [--kx-ramp-top:7rem] [--kx-ramp-ext:1rem] [--kx-ramp-fade:1.5rem]">
            <div className="kx-glass-bar kx-bar-prog absolute inset-x-0 top-0 h-[64px] z-10" />
            <div className="p-4 text-[12px] text-[var(--text-dim)] leading-relaxed">
              Ours, live: text sliding under a progressive frost. Same effect, already tuned,
              already shipped in five files.
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
