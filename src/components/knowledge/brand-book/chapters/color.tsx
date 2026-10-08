"use client";

/* Chapters 45–49: the colour palette, silver & Hub Blue, colour usage &
   proportions, colour for print & materials, contrast & legibility.

   The palette the owner approved on 27/09/2026 (Apple direction): black and
   white carry every piece; four neutrals; SILVER as the premium material
   (one smooth, slightly shiny gradient — never the logo); HUB BLUE for
   links and buttons only; status colours only for a state. Proportions:
   black or white 60 · neutrals 28 · silver 8 · Hub Blue 4. */

import {
  BRAND_COLORS, PROPORTIONS, SILVER, cmykText, contrast, grade, ratioText, rgbText,
} from "@/lib/brand-book/tokens";
import {
  B, Bullets, Chapter, Code, Downloads, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Swatch, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { MachineShot } from "../mockups";

const FILES = [
  { label: "Brand colors — CSS variables", href: "/brand/kit/koleex-colors.css", format: "CSS", note: "For websites and apps, with the silver gradient." },
  { label: "Brand colors — JSON", href: "/brand/kit/koleex-colors.json", format: "JSON", note: "HEX, RGB and CMYK starting values, silver and proportions." },
];

const PROP_FILL: Record<string, string> = { base: "#000000", neutral: "#F5F5F7", silver: SILVER.css, hub: "#567FB2" };

/** A silver headline on black — the premium signature. */
function SilverWords({ children, size = 40 }: { children: string; size?: number }) {
  return (
    <span
      className="font-semibold tracking-[-0.03em]"
      style={{ fontSize: size, lineHeight: 1.05, backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
    >
      {children}
    </span>
  );
}

/* ── 45 · Color Palette ────────────────────────────────────────────────── */

export function ColorPalette() {
  const group = (g: string) => BRAND_COLORS.filter((c) => c.group === g);
  return (
    <Chapter
      n={45}
      lead={<p>Black and white carry the brand. Silver makes it premium. Hub Blue makes it act. Nothing else.</p>}
      toc={[
        { id: "system", title: "The system" },
        { id: "core", title: "Black and white" },
        { id: "neutrals", title: "Neutrals" },
        { id: "silver", title: "Silver" },
        { id: "hub", title: "Hub Blue" },
        { id: "status", title: "Status colors" },
        { id: "color-files", title: "Files" },
      ]}
    >
      <Section id="system" title="The system">
        <div className="grid grid-cols-2 overflow-hidden rounded-[28px] ring-1 ring-black/5 md:grid-cols-4 dark:ring-white/15" style={{ minHeight: 220 }}>
          <div className="flex items-end bg-black p-5"><span className="text-[15px] font-semibold text-white">Black</span></div>
          <div className="flex items-end bg-white p-5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"><span className="text-[15px] font-semibold text-[#1D1D1F]">White</span></div>
          <div className="flex items-end p-5" style={{ background: SILVER.css }}><span className="text-[15px] font-semibold text-[#1D1D1F]">Silver</span></div>
          <div className="flex items-end p-5" style={{ background: "#567FB2" }}><span className="text-[15px] font-semibold text-white">Hub Blue</span></div>
        </div>
        <Specs rows={[
          ["Black and white", "The ground of every piece and the only colors of the logo"],
          ["Neutrals", "Graphite, Gray, Mist, Cloud — text, lines and quiet panels"],
          ["Silver", "The premium material — headlines on black, the machine, nameplates"],
          ["Hub Blue", "Links and buttons. Never decoration"],
          ["Status", "Green, amber, red — only to show a state"],
        ]} />
      </Section>

      <Section id="core" title="Black and white">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{group("core").map((c) => <Swatch key={c.id} c={c} big />)}</div>
      </Section>

      <Section id="neutrals" title="Neutrals">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{group("neutral").map((c) => <Swatch key={c.id} c={c} />)}</div>
      </Section>

      <Section id="silver" title="Silver">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{group("silver").map((c) => <Swatch key={c.id} c={c} big />)}</div>
        <P>Silver is one smooth gradient with a single soft highlight — never banded, never wavy. Full rules: <Ref n={46} />.</P>
      </Section>

      <Section id="hub" title="Hub Blue">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{group("hub").map((c) => <Swatch key={c.id} c={c} />)}</div>
      </Section>

      <Section id="status" title="Status colors">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{group("status").map((c) => <Swatch key={c.id} c={c} />)}</div>
        <Rule why="If green also decorates a banner, it can no longer mean “approved”.">
          Status colors appear only to show a state — approved, pending, error. Never as decoration.
        </Rule>
        <Specs rows={[
          ["Official warnings", "The headline and the warning object in Red #DC2626 — never a brighter red"],
          ["Emergency lines", "An emergency address or number in Amber #D97706 — never a bright yellow"],
          ["Sub-brands", "A named series such as NEXO keeps its own colours; they never touch the KOLEEX logo (ch. 16)"],
        ]} />
      </Section>

      <Section id="color-files" title="Files">
        <Downloads items={FILES} />
      </Section>
    </Chapter>
  );
}

/* ── 46 · Silver & Hub Blue ────────────────────────────────────────────── */

export function SilverHubBlue() {
  return (
    <Chapter
      n={46}
      lead={<p>Two colors beyond black and white, each with one job. Silver is the material. Hub Blue is the action.</p>}
      toc={[
        { id: "silver-gradient", title: "The silver gradient" },
        { id: "silver-where", title: "Where silver goes" },
        { id: "silver-never", title: "Silver — never" },
        { id: "blue-job", title: "Hub Blue’s one job" },
        { id: "blue-never", title: "Hub Blue — never" },
      ]}
    >
      <Section id="silver-gradient" title="The silver gradient">
        <Stage bg="#000000" h="auto" pad={48}>
          <div className="flex w-full flex-col items-center gap-8 text-center">
            <SilverWords size={56}>Stitch. Perfected.</SilverWords>
            <div className="h-[72px] w-full max-w-[520px] rounded-[18px]" style={{ background: SILVER.css }} />
          </div>
        </Stage>
        <Specs rows={[
          ["Stops", <span key="s" className="font-mono text-[13px]">{SILVER.stops.join(" → ")}</span>],
          ["Surfaces", <Code key="c">{SILVER.css}</Code>],
          ["Headlines on black", <Code key="t">{SILVER.cssText}</Code>],
          ["Print", `${SILVER.pantone} · ${SILVER.foil}`],
        ]} />
      </Section>

      <Section id="silver-where" title="Where silver goes">
        <Examples cols={3}>
          <Example tone="do" caption="Big headlines on black." bg="#000000" h={170}><SilverWords size={30}>Quiet power.</SilverWords></Example>
          <Example tone="do" caption="The painted edges of the business card." bg="#F5F5F7" h={170}>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-[70px] w-[118px] items-center justify-center rounded-[5px] bg-black"><Wordmark color="#FFFFFF" width={54} /></div>
              <div className="h-[7px] w-[118px] rounded-[2px]" style={{ background: SILVER.css }} />
            </div>
          </Example>
          <Example tone="do" caption="Silver foil on words and lines — covers, invitations." bg="#000000" h={170}>
            <div className="flex flex-col items-center gap-2"><SilverWords size={22}>Product Catalog</SilverWords><div className="h-px w-24" style={{ background: SILVER.css }} /></div>
          </Example>
        </Examples>
      </Section>

      <Section id="silver-never" title="Silver — never">
        <Rule why="The logo is black or white, always. Silver is the material around it — the moment the logo turns silver, it becomes decoration.">
          The logo is never silver. Not on screen, not in foil, not engraved to look like silver.
        </Rule>
        <Examples cols={3}>
          <Example tone="dont" caption="A silver logo." bg="#000000" h={140}>
            <span className="block" style={{ width: 150 }}><span className="block h-[22px] w-full" style={{ background: SILVER.css, WebkitMaskImage: "url(/brand/koleex-logo-white.svg)", maskImage: "url(/brand/koleex-logo-white.svg)", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }} /></span>
          </Example>
          <Example tone="dont" caption="Banded, wavy or brushed metal." bg="#000000" h={140}>
            <div className="h-[56px] w-[150px] rounded-[14px]" style={{ background: "linear-gradient(135deg,#8E8E93 0%,#E8E8ED 22%,#FFFFFF 40%,#AEAEB2 58%,#F2F2F5 76%,#8E8E93 100%)" }} />
          </Example>
          <Example tone="dont" caption="Silver on white — it disappears." bg="#FFFFFF" h={140}><SilverWords size={28}>Quiet power.</SilverWords></Example>
        </Examples>
      </Section>

      <Section id="blue-job" title="Hub Blue’s one job">
        <Stage bg="#FFFFFF" h="auto" pad={40}>
          <div className="flex flex-col items-center gap-5 text-center text-[#1D1D1F]">
            <p className="text-[32px] font-semibold tracking-[-0.025em]">The XSO-7800-4.</p>
            <div className="flex items-center gap-6">
              <span className="inline-flex h-10 items-center rounded-full px-5 text-[15px] font-medium text-white" style={{ background: "#567FB2" }}>Get a quote</span>
              <span className="text-[15px] font-medium" style={{ color: "#3E6796" }}>Learn more ›</span>
            </div>
          </div>
        </Stage>
        <Specs rows={[
          ["Filled button", "Steel #567FB2, white text"],
          ["Links on white", "Deep #3E6796"],
          ["Links on black", "Sky #7FA9D6"],
          ["Pressed or selected", "Ice #BCD8F0 behind dark text"],
        ]} />
      </Section>

      <Section id="blue-never" title="Hub Blue — never">
        <Bullets items={[
          "On the logo, and never as the background behind it.",
          "As a decorative line, frame, label, icon color or chart color.",
          "As a large field — a blue banner, a blue slide, a blue wall.",
          <>The Hub gradient belongs to the Koleex Hub mark and interface only (<Ref n={42} />).</>,
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 47 · Color Usage & Proportions ────────────────────────────────────── */

export function ColorUsage() {
  return (
    <Chapter
      n={47}
      lead={<p>Most of every piece is black or white. The rest is quiet gray — and a small amount of silver and blue, exactly where they do their job.</p>}
      toc={[
        { id: "proportions", title: "Proportions" },
        { id: "dark-light", title: "Black first, then white" },
        { id: "two-versions", title: "Black and white versions" },
        { id: "which", title: "Which one, where" },
        { id: "usage-donts", title: "What never to do" },
      ]}
    >
      <Section id="proportions" title="Proportions">
        <div className="overflow-hidden rounded-[28px]">
          <div className="flex h-[120px]">
            {PROPORTIONS.map((p) => (
              <div key={p.id} style={{ flex: p.pct, background: PROP_FILL[p.id], boxShadow: p.id === "neutral" ? "inset 0 0 0 1px rgba(0,0,0,0.06)" : undefined }} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {PROPORTIONS.map((p) => (
            <div key={p.id}>
              <p className="text-[34px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{p.pct}%</p>
              <p className="text-[14px] text-[var(--text-dim)]">{p.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="dark-light" title="Black first, then white">
        <Examples cols={2}>
          <Example tone="do" caption="Black — heroes, ads, launches, social, booths." bg="#000000" h={220}>
            <div className="flex flex-col items-center gap-3 text-center"><SilverWords size={30}>Stitch. Perfected.</SilverWords><MachineShot w={180} label={false} /></div>
          </Example>
          <Example tone="do" caption="White — catalogs, the website, documents, anything printed in the office." bg="#FFFFFF" h={220}>
            <div className="flex flex-col items-center gap-3 text-center text-[#1D1D1F]"><p className="text-[26px] font-semibold tracking-[-0.02em]">The lineup.</p><MachineShot w={180} dark={false} label={false} /></div>
          </Example>
        </Examples>
      </Section>

      <Section id="two-versions" title="Every piece, in black and in white">
        <Rule why="Black is KOLEEX at its strongest; white is KOLEEX in daylight, in a bright room, next to a partner’s white space. Having both ready means no one invents a third.">
          Every KOLEEX piece exists in two versions: black and white. The main version is set below — mostly
          black; the other is ready for where the main one does not work. One piece is one version — never half and half.
        </Rule>
        <Table
          head={["Piece", "Main version", "Second version"]}
          rows={[
            ["Logo", "White logo on black", "Black logo on white"],
            ["Business card", "Black both sides, raised logo, silver edges (ch. 91)", "White both sides, raised black logo, silver edges"],
            ["Envelope", "White, black liner (ch. 92)", "Black, white liner"],
            ["Catalog, company profile cover", "Black (ch. 102–103)", "White"],
            ["Social posts", "Black posts", "White posts — alternating on the grid (ch. 79)"],
            ["Website", "The black hero (ch. 75)", "The light pages below it"],
            ["Machine body", "White is the KOLEEX machine (ch. 107)", "Black — for special editions only"],
            ["Nameplate", "Black, engraved (ch. 108)", "White, black print — for black machines"],
            ["Cartons, spare parts, manuals", "Set per product (ch. 110–113)", "Set per product"],
            ["Booth", "All black (ch. 114)", "All white, black halo-lit letters"],
            ["Showroom, reception", "Black (ch. 117–118)", "White"],
            ["Vehicles", "Black, white logo (ch. 120)", "White, black logo"],
            ["Uniforms", "Black, white logo (ch. 122)", "White, black logo"],
            ["Merchandise", "Black, white logo (ch. 123)", "White, black logo"],
            ["Gift box", "Black, silver band (ch. 124)", "White, black band"],
            ["Signs", "White halo-lit letters on a dark wall", "Black letters on a light wall (ch. 39)"],
            ["Business documents", "White — paper documents stay white (ch. 94)", "—"],
          ]}
        />
        <Note>When to use white: bright daylight and outdoor heat (vehicles in hot countries), white rooms and partner spaces, and wherever black would look heavy or print badly.</Note>
      </Section>

      <Section id="which" title="Which one, where">
        <Table
          head={["Piece", "Ground", "Silver", "Hub Blue"]}
          rows={[
            ["Website hero, ads, launch posts", "Black", "Headline", "Links and buttons"],
            ["Catalog, spec sheet, website pages", "White", "—", "Links only"],
            ["Business documents", "White", "—", "—"],
            ["Booth, roll-up, fascia", "Black", "Headline", "—"],
            ["Business card", "Black, both sides", "Painted edges", "—"],
            ["Nameplate", "Black anodized metal", "—", "—"],
          ]}
        />
      </Section>

      <Section id="usage-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="A blue background." bg="#567FB2" h={140}><Wordmark color="#FFFFFF" width={130} /></Example>
          <Example tone="dont" caption="Status colors as decoration." bg="#FFFFFF" h={140}>
            <p className="text-[18px] font-semibold"><span className="text-[#059669]">Quality</span> <span className="text-[#D97706]">you</span> <span className="text-[#DC2626]">trust</span></p>
          </Example>
          <Example tone="dont" caption="Any other gradient or color." bg="#FFFFFF" h={140}>
            <div className="h-16 w-40 rounded-[16px]" style={{ background: "linear-gradient(135deg,#7C3AED,#EC4899,#F59E0B)" }} />
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 48 · Color for Print & Materials ──────────────────────────────────── */

export function ColorPrint() {
  const printable = BRAND_COLORS.filter((c) => c.group !== "status" && c.group !== "hub");
  return (
    <Chapter
      n={48}
      lead={<p>Screens mix light; printers mix ink. Every print color — and every silver — is matched on a physical proof before a job runs.</p>}
      toc={[
        { id: "values", title: "Print values" },
        { id: "silver-print", title: "Silver in print" },
        { id: "black", title: "Printing black" },
        { id: "proof", title: "The proof rule" },
        { id: "materials-color", title: "Materials" },
      ]}
    >
      <Section id="values" title="Print values">
        <Table
          head={["Color", "HEX", "RGB", "CMYK — starting value"]}
          rows={printable.map((c) => [
            <span key="n" className="flex items-center gap-2"><span className="h-4 w-4 shrink-0 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ background: c.id === "silver" ? SILVER.css : c.hex }} />{c.name}</span>,
            <Code key="h">{c.hex}</Code>,
            rgbText(c.hex),
            c.id === "silver" ? SILVER.pantone : cmykText(c.hex),
          ])}
        />
        <Note tone="warn">CMYK values are calculated from the screen colors — a starting point for the printer, not a finished recipe. Hub Blue is for screens; printed pieces are black, white and silver.</Note>
      </Section>

      <Section id="silver-print" title="Silver in print">
        <Specs rows={[
          ["Paper and card", `${SILVER.foil} — never silver ink simulated with gray`],
          ["When foil is not possible", `${SILVER.pantone} as a spot color`],
          ["Edges", "Painted silver on thick board — the business card (ch. 91)"],
          ["Signs", "No silver on signs — halo-lit black or white letters (ch. 39)"],
        ]} />
      </Section>

      <Section id="black" title="Printing black">
        <Specs rows={[
          ["Logo and text", "K100 only (C0 M0 Y0 K100) — sharp edges, no registration shift"],
          ["Large black areas", "Rich black C60 M40 Y40 K100 — deep and even"],
          ["White logo on black", "A knock-out (unprinted paper), never white ink on black ink"],
        ]} />
      </Section>

      <Section id="proof" title="The proof rule">
        <Rule why="Paper, ink, foil and press change the color. The only color that counts is the one on the real material.">
          No KOLEEX print job, sign or garment runs without a physical proof approved against the brand colors.
        </Rule>
        <Bullets items={[
          "Ask for a hard proof on the final paper or material — with the real foil.",
          "Check it in daylight next to an approved KOLEEX sample.",
          "Record the approved values and the printer for the next run.",
        ]} />
      </Section>

      <Section id="materials-color" title="Materials">
        <Table
          head={["Material", "Black", "White", "Silver"]}
          rows={[
            ["Coated paper", "K100 / rich black for areas", "Paper white", "Silver foil"],
            ["Uncoated paper", "K100", "Paper white", "Silver foil, tested first"],
            ["Embroidery thread", "Black thread", "White thread", "—"],
            ["Vinyl and signs", "Matte black vinyl", "White vinyl", "—"],
            ["Metal", "Black print or laser marking", "Engraved on black anodizing", "—"],
          ]}
        />
      </Section>
    </Chapter>
  );
}

/* ── 49 · Contrast & Legibility ────────────────────────────────────────── */

const PAIRS: Array<[string, string, string]> = [
  ["#1D1D1F", "#FFFFFF", "Graphite on White"],
  ["#6E6E73", "#FFFFFF", "Gray on White"],
  ["#1D1D1F", "#F5F5F7", "Graphite on Cloud"],
  ["#3E6796", "#FFFFFF", "Deep on White (links)"],
  ["#FFFFFF", "#567FB2", "White on Steel (buttons)"],
  ["#F5F5F7", "#000000", "Cloud on Black"],
  ["#98989D", "#000000", "Gray on Black"],
  ["#C7C7CC", "#000000", "Silver on Black"],
  ["#7FA9D6", "#000000", "Sky on Black (links)"],
  ["#AEAEB2", "#FFFFFF", "Silver on White"],
];

function suitableFor(ratio: number): string {
  if (ratio >= 4.5) return "Any text";
  if (ratio >= 3) return "Large text (24 px+) and graphics only";
  return "Never for text";
}

export function Contrast() {
  return (
    <Chapter
      n={49}
      lead={<p>Our readers use phones in bright workshops and read signs across exhibition halls. Every pair below is measured — use the ones that pass for the job.</p>}
      toc={[
        { id: "standard", title: "The standard" },
        { id: "pairs", title: "Measured pairs" },
        { id: "sizes", title: "Minimum text sizes" },
      ]}
    >
      <Section id="standard" title="The standard">
        <Rule why="4.5 : 1 is the international accessibility standard (WCAG AA). It is also simply what people can read in poor light.">
          Text needs at least <B>4.5 : 1</B> against its background. Large text and graphics need <B>3 : 1</B>.
        </Rule>
      </Section>

      <Section id="pairs" title="Measured pairs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAIRS.map(([fg, bg, name]) => {
            const r = contrast(fg, bg);
            const g = grade(r);
            return (
              <div key={name} className="overflow-hidden rounded-[24px] bg-[var(--bg-secondary)]">
                <Stage bg={bg} h={104} pad={16} style={{ borderRadius: 0 }}>
                  <p className="text-[19px] font-semibold tracking-[-0.01em]" style={{ color: fg }}>Lockstitch 5,000 SPM</p>
                </Stage>
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-semibold text-[var(--text-primary)]">{name}</p>
                    <span className="font-mono text-[13px] font-semibold" style={{ color: g === "Fail" ? "#DC2626" : g === "AA Large" ? "#D97706" : "#059669" }}>{ratioText(r)}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--text-dim)]">{suitableFor(r)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="sizes" title="Minimum text sizes">
        <Specs rows={[
          ["Screens — body text", "17 px (the type scale, ch. 51)"],
          ["Screens — smallest text", "12 px"],
          ["Print — body text", "9 pt"],
          ["Print — smallest text (legal lines)", "6.5 pt"],
          ["Signs", "Letter height about 25 mm for every 3 m of reading distance (ch. 39)"],
        ]} />
      </Section>
    </Chapter>
  );
}
