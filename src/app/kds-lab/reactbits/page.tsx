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
const LiquidGlass = dynamic(() => import("@/components/ui/LiquidGlass"), { ssr: false });
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

/** One filter at a time: only the tile under the pointer refracts.
 *
 *  The grid version measured 16.7ms at p95 — two frames at 120Hz — with ten
 *  filters live, and Home has forty-four. This keeps the effect and deletes the
 *  count: at most ONE GlassSurface exists at any moment.
 *
 *  What it trades is a mount on every hover, and that is the thing to watch
 *  rather than the filter itself — the component rebuilds its displacement map
 *  when it appears, so moving fast across a grid is a churn of mounts. The
 *  probe underneath sweeps the row deliberately to catch it. */
function HoverRefractRow() {
  const [hot, setHot] = useState<number | null>(null);
  return (
    <div className="grid grid-cols-4 gap-3">
      {TILES.slice(0, 4).map((t, i) => (
        <div
          key={t}
          onPointerEnter={() => setHot(i)}
          onPointerLeave={() => setHot((h) => (h === i ? null : h))}
          className="relative rounded-2xl border border-white/[0.10] aspect-square"
        >
          {hot === i && (
            <div className="absolute inset-0" aria-hidden>
              <LiquidGlass radius={16} className="h-full rounded-2xl" >{null}</LiquidGlass>
            </div>
          )}
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl ${hot === i ? "" : "kx-glass bg-[#0c0c0c]"}`}>
            <span className="h-7 w-7 rounded-lg bg-white/70" />
            <span className="text-[11px] text-white/85">{t}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Measures frame time with the refracting tiles present and hidden, so the
 *  verdict on "16 filters" is a number rather than a feeling. */
function TileCost() {
  const [out, setOut] = useState<string>("");
  const run = async () => {
    setOut("measuring…");
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const frames = (ms = 900) => new Promise<{ med: number; p95: number }>((res) => {
      const d: number[] = []; let last = performance.now(); const t0 = last;
      const loop = (t: number) => { d.push(t - last); last = t;
        if (t - t0 < ms) requestAnimationFrame(loop);
        else { const s = d.slice(3).sort((a, b) => a - b);
          res({ med: +s[Math.floor(s.length / 2)].toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2) }); } };
      requestAnimationFrame(loop);
    });
    const filters = Array.from(document.querySelectorAll<HTMLElement>(".glass-surface"));
    const on = await frames();
    filters.forEach((f) => (f.style.display = "none")); await wait(400);
    const off = await frames();
    filters.forEach((f) => (f.style.display = "")); await wait(300);
    setOut(`${filters.length} filters on: ${on.med}ms / ${on.p95} p95  ·  off: ${off.med}ms / ${off.p95} p95`);
  };
  return (
    <div className="mt-3 flex items-center gap-3 flex-wrap">
      <button onClick={run} className="text-[11px] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        Measure the cost
      </button>
      <span className="text-[11px] text-[var(--text-dim)] tabular-nums">{out}</span>
    </div>
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

const TILES = ["Products", "Inventory", "Purchases", "Catalogs", "Sales", "CRM", "Invoices", "Customers"];

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
          {/* BOTH SIT ON A RULED GROUND, and that is the whole point of the
              rework. My first version put them on the Hub's near-flat dark
              page: refraction of a flat colour IS a flat colour, so the card
              read as broken rather than as pointless. Straight lines make the
              difference unmissable — ours SOFTENS them, theirs BENDS them. */}
          <div className="relative rounded-2xl overflow-hidden p-5" style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #BCD8F0 0 2px, transparent 2px 22px)," +
              "repeating-linear-gradient(0deg, #567FB2 0 2px, transparent 2px 22px)," +
              "linear-gradient(135deg, #16233A 0%, #0A0E17 100%)",
          }}>
            <div className="grid sm:grid-cols-2 gap-4 items-start">
              <div>
                <div className="text-[11px] text-white/70 mb-1.5">Ours — .kx-glass (54 files)</div>
                <div className="kx-glass rounded-2xl border border-white/15 bg-white/5 p-4 h-[116px]">{CARD}</div>
              </div>
              <div>
                <div className="text-[11px] text-white/70 mb-1.5">Theirs — GlassSurface (fixed 300px)</div>
                <GlassSurface width={300} height={116} borderRadius={16}
                  displace={6} distortionScale={-160} redOffset={4} greenOffset={14} blueOffset={24}
                  brightness={60} opacity={0.86} blur={2} backgroundOpacity={0.05} saturation={1.3}>
                  <div className="p-4 w-full">{CARD}</div>
                </GlassSurface>
              </div>
            </div>
            {/* The wrapper that removes the only structural objection left:
                GlassSurface takes PIXELS, so it cannot fit a fluid card.
                LiquidGlass measures the box and hands it real numbers. This one
                is full-width and follows the column. */}
            <div className="mt-4">
              <div className="text-[11px] text-white/70 mb-1.5">
                Ours — LiquidGlass (same filter, fluid width)
              </div>
              <LiquidGlass radius={16} className="rounded-2xl border border-white/15">
                <div className="p-4">{CARD}</div>
              </LiquidGlass>
            </div>
          </div>
        </Section>

        {/* 1b ── tiles */}
        <Section
          n="01b" title="The same two, on app tiles" verdict="risky"
          note="Owner asked to compare them on the surface that actually matters. Eight tiles each, over a coloured ground so there is something to bend. Ours frosts what is behind; theirs warps it. The measurement underneath is the part that decides it — 16 SVG filters is a different question from one."
        >
          <div className="rounded-2xl overflow-hidden p-5" style={{
            backgroundImage:
              "radial-gradient(60% 70% at 20% 30%, #7FA9D6 0%, transparent 60%)," +
              "radial-gradient(55% 65% at 80% 70%, #B08BD6 0%, transparent 58%)," +
              "repeating-linear-gradient(115deg, rgba(255,255,255,.22) 0 2px, transparent 2px 26px)," +
              "linear-gradient(150deg, #16233A 0%, #0A0E17 100%)",
          }}>
            <div className="text-[11px] text-white/75 mb-2">Ours — .kx-glass</div>
            <div className="grid grid-cols-4 gap-3 mb-5">
              {TILES.map((t) => (
                <div key={t} className="kx-glass rounded-2xl border border-white/[0.10] bg-[#0c0c0c] aspect-square flex flex-col items-center justify-center gap-2">
                  <span className="h-7 w-7 rounded-lg bg-white/70" />
                  <span className="text-[11px] text-white/85">{t}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-white/75 mb-2">Theirs — LiquidGlass (refraction)</div>
            <div className="grid grid-cols-4 gap-3">
              {TILES.map((t) => (
                <LiquidGlass key={t} radius={16} className="rounded-2xl border border-white/[0.10] aspect-square">
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                    <span className="h-7 w-7 rounded-lg bg-white/70" />
                    <span className="text-[11px] text-white/85">{t}</span>
                  </div>
                </LiquidGlass>
              ))}
            </div>
            <div className="text-[11px] text-white/75 mb-2 mt-5">
              Ours — refraction ON HOVER ONLY (one filter, never 44)
            </div>
            <HoverRefractRow />
          </div>
          <TileCost />
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
                  <CountUp value={kpi} format={(n) => "USD " + Math.round(n).toLocaleString("en-US")} />
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
          {/* SCROLL THIS BOX. The first version was static, and a progressive
              frost with nothing passing under it shows nothing at all — the
              owner said so immediately and was right. The effect IS the
              transition, so the demo has to move. */}
          <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden h-[240px] relative kx-bar-host [--kx-ramp-top:0rem] [--kx-ramp-ext:2.5rem] [--kx-ramp-fade:1.25rem]">
            {/* --kx-ramp-top IS A PAGE-SCALE VALUE. It stretches the layer
                UPWARD (inset: calc(var(--kx-ramp-top) * -1) ...) so ONE ramp
                can cover a whole stack of sticky bars above it. In a 190px box
                with nothing above the bar, 9rem put all four layers at -143px
                — entirely outside the container, clipped away by
                overflow-hidden. Measured, after the owner said it still felt
                wrong: zero frost on screen, which is why the row under "Sticky
                header" stayed razor sharp. Same failure as the Purchase edge
                earlier: the geometry moved the frost off-screen while every
                class name still looked right.

                THE FOUR <i> ARE THE EFFECT. kx-bar-prog is a filterless shell;
                its four CHILDREN carry the masked 3/7/14/28px ramp. I wrote it
                self-closing and the section rendered nothing at all — the owner
                said "I think have something wrong" and was looking at an empty
                box, not a subtle one. Every real use in the Hub (PageHeader,
                ProductList, ProductProfile, Contacts) has them. */}
            <div aria-hidden className="kx-glass-bar kx-bar-prog absolute inset-x-0 top-0 h-[62px] z-10 pointer-events-none">
              <i /><i /><i /><i />
            </div>
            {/* The label needs WEIGHT, or it reads as text that happened to
                land on a row rather than as a header the rows pass beneath.
                In the real Hub the header carries a title, tabs and controls,
                which supply that weight on their own. */}
            <div className="absolute inset-x-0 top-0 h-[62px] z-20 flex items-center justify-between px-4 pointer-events-none">
              <span className="text-[15px] font-bold text-[var(--text-primary)]">Invoices</span>
              <span className="text-[11px] text-[var(--text-dim)]">14 open</span>
            </div>
            <div className="h-full overflow-y-auto pt-[62px] px-4 pb-4 space-y-2">
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className="flex items-center justify-between text-[12px] text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2">
                  <span>Invoice INV-2026-{String(1040 + i)}</span>
                  <span className="tabular-nums text-[var(--text-dim)]">USD {(3200 + i * 417).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-[var(--text-dim)] mt-2">
            Scroll inside the box — the rows dissolve into frost as they pass under the header
            instead of being cut by a hard edge.
          </p>
        </Section>
      </div>
    </div>
  );
}
