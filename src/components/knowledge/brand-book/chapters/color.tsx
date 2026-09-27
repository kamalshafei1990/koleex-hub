"use client";

/* Chapters 45–49: color palette, Hub Blue, usage & proportions, print &
   materials, contrast. Every HEX comes from lib/brand-book/tokens; every RGB,
   CMYK and contrast figure on these pages is computed from it. */

import {
  BRAND_COLORS, HUB_GRADIENT, cmykText, color, contrast, grade, ratioText, rgbText,
} from "@/lib/brand-book/tokens";
import {
  B, Bullets, Chapter, Code, Downloads, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Swatch, Table,
} from "../kit";
import { Wordmark } from "../marks";

const COLOR_FILES = [
  { label: "Brand colors — CSS variables", href: "/brand/kit/koleex-colors.css", format: "CSS", note: "For websites and apps." },
  { label: "Brand colors — JSON", href: "/brand/kit/koleex-colors.json", format: "JSON", note: "HEX, RGB and CMYK starting values for every color." },
];

/* ── 45 · Color Palette ────────────────────────────────────────────────── */

export function ColorPalette() {
  const group = (g: string) => BRAND_COLORS.filter((c) => c.group === g);
  return (
    <Chapter
      n={45}
      lead={
        <p>
          KOLEEX is black and white first. Hub Blue is the one brand color beside them — the accent that
          makes a KOLEEX layout recognisable. Greys organise, and three status colors appear only when
          something has a state.
        </p>
      }
      toc={[
        { id: "hierarchy", title: "The hierarchy" },
        { id: "core", title: "Core: black and white" },
        { id: "hub", title: "Hub Blue" },
        { id: "neutrals", title: "Neutrals" },
        { id: "status", title: "Status colors" },
        { id: "retired", title: "Colors we no longer use" },
        { id: "color-files", title: "Files" },
      ]}
    >
      <Section id="hierarchy" title="The hierarchy">
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          <div className="grid grid-cols-[2fr_2fr_1fr]" style={{ height: 120 }}>
            <div className="flex items-end p-4" style={{ background: "#000000" }}><span className="text-[12px] font-semibold text-white">1 · Black</span></div>
            <div className="flex items-end p-4" style={{ background: "#FFFFFF" }}><span className="text-[12px] font-semibold text-black">2 · White</span></div>
            <div className="flex items-end p-4" style={{ background: HUB_GRADIENT.css }}><span className="text-[12px] font-semibold text-white">3 · Hub Blue</span></div>
          </div>
        </div>
        <Rule why="A restrained palette is what makes the blue — and the product — stand out. Every extra color competes with both.">
          Black → white → Hub Blue. No other color carries the brand. Greys organise the page; status colors
          show states. Nothing else is added.
        </Rule>
      </Section>

      <Section id="core" title="Core: black and white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{group("core").map((c) => <Swatch key={c.id} c={c} big />)}</div>
        <Note><B>Black and Ink:</B> the logo is pure black #000000. Large dark surfaces use Ink #0A0A0A — a softer black that prints and displays more evenly.</Note>
      </Section>

      <Section id="hub" title="Hub Blue">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{group("hub").map((c) => <Swatch key={c.id} c={c} />)}</div>
        <P>The family, its gradient and where it may be used are in <Ref n={46} />.</P>
      </Section>

      <Section id="neutrals" title="Neutrals">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">{group("neutral").map((c) => <Swatch key={c.id} c={c} />)}</div>
      </Section>

      <Section id="status" title="Status colors">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{group("status").map((c) => <Swatch key={c.id} c={c} />)}</div>
        <Rule why="If green also decorates a banner, it can no longer mean “approved”.">
          Status colors appear only to show a state — approved, pending, error — in the Hub, in documents
          and in charts. They are never decoration.
        </Rule>
      </Section>

      <Section id="retired" title="Colors we no longer use">
        <P>Earlier KOLEEX material used a different accent system. These colors are retired — replace them when you meet them:</P>
        <Table
          head={["Retired", "Was used for", "Use instead"]}
          rows={[
            [<Code key="a">#0071E3 · #007AFF</Code>, "Accent blue, links, buttons", <span key="b">Hub Blue Deep <Code>#3E6796</Code> on white · Sky <Code>#7FA9D6</Code> on dark</span>],
            [<Code key="a">#86868B</Code>, "Secondary text", <span key="b">Slate <Code>#4B5563</Code> (passes contrast on white)</span>],
            [<Code key="a">#34C759 · #FF9500 · #FF3B30</Code>, "Status", <span key="b">Status Green, Amber and Red from this palette</span>],
            [<Code key="a">Multi-color category palettes</Code>, "Charts, diagrams, section colors", <span key="b">Black, greys and the Hub Blue family (<Ref n={61} />)</span>],
          ]}
        />
        <Note>Inside the Hub’s Core interface, sliders and progress bars keep their functional blue <Code>#0066FF</Code>. It is an interface control color, never a marketing or print color.</Note>
      </Section>

      <Section id="color-files" title="Files">
        <Downloads items={COLOR_FILES} />
      </Section>
    </Chapter>
  );
}

/* ── 46 · Hub Blue ─────────────────────────────────────────────────────── */

export function HubBlue() {
  return (
    <Chapter
      n={46}
      lead={
        <p>
          Hub Blue is the blue of the “hub” in the Koleex Hub mark — a cool, steady steel blue that moves
          to a pale ice. It became the third KOLEEX brand color on 31/07/2026, and it is used across
          everything: the Hub, marketing and print.
        </p>
      }
      toc={[
        { id: "family", title: "The family" },
        { id: "gradient", title: "The Hub gradient" },
        { id: "where", title: "Where Hub Blue goes" },
        { id: "how-much", title: "How much" },
        { id: "blue-donts", title: "What never to do" },
      ]}
    >
      <Section id="family" title="The family">
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          <div className="grid grid-cols-4" style={{ height: 150 }}>
            {["deep", "steel", "sky", "ice"].map((id) => {
              const c = color(id);
              const onDark = id === "deep" || id === "steel";
              return (
                <div key={id} className="flex flex-col justify-end p-3" style={{ background: c.hex }}>
                  <span className="text-[12px] font-semibold" style={{ color: onDark ? "#FFFFFF" : "#0A0A0A" }}>{c.name.replace("Hub Blue ", "")}</span>
                  <span className="font-mono text-[11px]" style={{ color: onDark ? "#FFFFFF" : "#0A0A0A" }}>{c.hex}</span>
                </div>
              );
            })}
          </div>
        </div>
        <Table
          head={["Tone", "HEX", "RGB", "CMYK (starting value)", "Main job"]}
          rows={["deep", "steel", "sky", "ice"].map((id) => {
            const c = color(id);
            return [<B key="n">{c.name}</B>, <Code key="h">{c.hex}</Code>, rgbText(c.hex), cmykText(c.hex), c.role];
          })}
        />
      </Section>

      <Section id="gradient" title="The Hub gradient">
        <div className="grid grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)] gap-4">
          <div className="h-[200px] rounded-2xl" style={{ background: HUB_GRADIENT.css }} />
          <div className="space-y-4">
            <Specs rows={[
              ["From", <span key="f"><Code>{HUB_GRADIENT.from}</Code> Steel</span>],
              ["To", <span key="t"><Code>{HUB_GRADIENT.to}</Code> Ice</span>],
              ["Direction", "Top to bottom (vertical) — the canonical form. Left to right for thin horizontal bars."],
              ["CSS", <Code key="c">{HUB_GRADIENT.css}</Code>],
            ]} />
          </div>
        </div>
        <P>The gradient is the Hub’s signature. Use it small: a line, a bar, a highlight, an icon, the “hub” script — never a full background behind text or behind the logo.</P>
      </Section>

      <Section id="where" title="Where Hub Blue goes">
        <Examples cols={3}>
          <Example tone="do" caption="Links and key words on white — in Deep." bg="#FFFFFF" h={150}>
            <p className="max-w-[220px] text-[13px] leading-6 text-[#1A1A1A]">Download the <span className="font-semibold text-[#3E6796] underline underline-offset-2">full specification</span> for the direct-drive lockstitch.</p>
          </Example>
          <Example tone="do" caption="A thin gradient line that finishes a layout." bg="#0A0A0A" h={150} pad={0}>
            <div className="relative flex h-[150px] w-full items-center justify-center">
              <Wordmark color="#FFFFFF" width={140} />
              <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: HUB_GRADIENT.cssHorizontal }} />
            </div>
          </Example>
          <Example tone="do" caption="Accents on dark — in Sky." bg="#0A0A0A" h={150}>
            <div className="text-white">
              <p className="text-[9px] tracking-[0.2em] text-[#7FA9D6]">NEW · OVERLOCK</p>
              <p className="mt-1 text-[18px] font-bold leading-tight">Four threads.<br />One pass.</p>
            </div>
          </Example>
          <Example tone="do" caption="Charts: the family in order, darkest first." bg="#FFFFFF" h={150}>
            <div className="flex h-[96px] items-end gap-2">
              {[["#3E6796", 90], ["#567FB2", 70], ["#7FA9D6", 52], ["#BCD8F0", 34], ["#E5E7EB", 22]].map(([c, h]) => (
                <div key={c as string} className="w-7 rounded-t" style={{ background: c as string, height: h as number }} />
              ))}
            </div>
          </Example>
          <Example tone="do" caption="A quiet Ice panel behind dark text." bg="#FFFFFF" h={150}>
            <div className="rounded-xl bg-[#BCD8F0] px-4 py-3 text-[12.5px] font-medium text-[#0A0A0A]">Technical support in English, 中文 and العربية</div>
          </Example>
          <Example tone="do" caption="Interactive elements and AI features in the Hub." bg="#0A0A0A" h={150}>
            <span className="rounded-full px-4 py-2 text-[12px] font-semibold text-white" style={{ background: HUB_GRADIENT.cssHorizontal }}>Ask Koleex AI</span>
          </Example>
        </Examples>
      </Section>

      <Section id="how-much" title="How much">
        <Rule why="Used sparingly, the blue marks what matters. Used everywhere, it marks nothing.">
          Hub Blue is a touch: about <B>5%</B> of a layout, never more than 10%. It is never a flood — no
          full blue backgrounds, no blue logo.
        </Rule>
        <div className="flex h-5 overflow-hidden rounded-full border border-[var(--border-subtle)]">
          <div style={{ flex: 55, background: "#FFFFFF" }} />
          <div style={{ flex: 40, background: "#0A0A0A" }} />
          <div style={{ flex: 5, background: "#567FB2" }} />
        </div>
        <P>Typical balance: 55% white · 40% black and greys · 5% Hub Blue. Dark-led pieces swap the first two. See <Ref n={47} />.</P>
      </Section>

      <Section id="blue-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="A full blue background." bg="#567FB2" h={140}>
            <p className="text-[18px] font-bold text-white">New series</p>
          </Example>
          <Example tone="dont" caption="Blue body text or blue paragraphs." bg="#FFFFFF" h={140}>
            <p className="max-w-[220px] text-[12px] leading-5 text-[#567FB2]">Our machines are tested before shipping and supported in your language by our technical team.</p>
          </Example>
          <Example tone="dont" caption="Other blues next to Hub Blue." bg="#FFFFFF" h={140}>
            <div className="flex gap-2">{["#567FB2", "#0071E3", "#1E90FF", "#00A3E0"].map((c) => <div key={c} className="h-14 w-10 rounded" style={{ background: c }} />)}</div>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 47 · Usage & Proportions ──────────────────────────────────────────── */

function Poster({ dark }: { dark: boolean }) {
  const fg = dark ? "#FFFFFF" : "#0A0A0A";
  return (
    <div className="relative flex h-[250px] w-[200px] flex-col justify-between overflow-hidden rounded-md p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.12)]" style={{ background: dark ? "#0A0A0A" : "#FFFFFF" }}>
      <p className="text-[8px] tracking-[0.2em]" style={{ color: dark ? "#7FA9D6" : "#3E6796" }}>SPREADING · NEW</p>
      <div className="flex-1 my-3 rounded" style={{ background: dark ? "#1A1A1A" : "#F5F5F5" }} />
      <p className="text-[15px] font-bold leading-tight" style={{ color: fg }}>Lay it flat.<br />Cut it right.</p>
      <div className="mt-3 flex items-center justify-between">
        <Wordmark color={dark ? "#FFFFFF" : "#000000"} width={60} />
        <div className="h-[2px] w-10" style={{ background: HUB_GRADIENT.cssHorizontal }} />
      </div>
    </div>
  );
}

export function ColorUsage() {
  return (
    <Chapter
      n={47}
      lead={
        <p>
          The same palette makes two kinds of layout: light-led for things people read and file, dark-led
          for things people see from a distance or scroll past. Both keep the blue to a touch.
        </p>
      }
      toc={[
        { id: "two-modes", title: "Light-led and dark-led" },
        { id: "which", title: "Which one, where" },
        { id: "proportions", title: "Proportions" },
        { id: "usage-donts", title: "What never to do" },
      ]}
    >
      <Section id="two-modes" title="Light-led and dark-led">
        <Examples cols={2}>
          <Example tone="do" caption={<><B>Light-led.</B> White ground, black type, a line of Hub Blue.</>} bg="#F5F5F5" h={290}><Poster dark={false} /></Example>
          <Example tone="do" caption={<><B>Dark-led.</B> Ink ground, white type, Sky accents.</>} bg="#E5E7EB" h={290}><Poster dark /></Example>
        </Examples>
      </Section>

      <Section id="which" title="Which one, where">
        <Table
          head={["Light-led (white ground)", "Dark-led (Ink ground)"]}
          rows={[
            ["Business documents: quotations, invoices, contracts, packing lists", "Social media posts and stories"],
            ["Catalogs, spec sheets, manuals, price information", "Posters, exhibition walls, roll-ups"],
            ["Letterhead, business card backs, email", "Covers: catalog, company profile, presentations"],
            ["Website content pages", "Video intros and outros, website heroes"],
          ]}
        />
        <Note>Anything customers print on an office printer stays light-led — a black flood wastes toner and turns grey.</Note>
      </Section>

      <Section id="proportions" title="Proportions">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            ["Light-led", [["#FFFFFF", 55], ["#0A0A0A", 25], ["#E5E7EB", 15], ["#567FB2", 5]]],
            ["Dark-led", [["#0A0A0A", 55], ["#FFFFFF", 25], ["#1A1A1A", 15], ["#7FA9D6", 5]]],
          ].map(([name, parts]) => (
            <div key={name as string} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
              <p className="text-[13.5px] font-semibold text-[var(--text-primary)]">{name as string}</p>
              <div className="mt-3 flex h-6 overflow-hidden rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
                {(parts as Array<[string, number]>).map(([c, f]) => <div key={c} style={{ flex: f, background: c }} />)}
              </div>
              <p className="mt-2 font-mono text-[11.5px] text-[var(--text-dim)]">{(parts as Array<[string, number]>).map(([c, f]) => `${f}% ${c}`).join(" · ")}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="usage-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="Many colors for decoration." bg="#FFFFFF" h={140}>
            <div className="grid grid-cols-3 gap-1.5">{["#E07A5F", "#81B29A", "#F2CC8F", "#9B8BC4", "#56A3C8", "#C86B98"].map((c) => <div key={c} className="h-8 w-14 rounded" style={{ background: c }} />)}</div>
          </Example>
          <Example tone="dont" caption="Status colors as decoration." bg="#FFFFFF" h={140}>
            <p className="text-[18px] font-bold"><span className="text-[#059669]">Quality</span> <span className="text-[#D97706]">you</span> <span className="text-[#DC2626]">trust</span></p>
          </Example>
          <Example tone="dont" caption="Gradients other than the Hub gradient." bg="#FFFFFF" h={140}>
            <div className="h-16 w-40 rounded-xl" style={{ background: "linear-gradient(135deg,#7C3AED,#EC4899,#F59E0B)" }} />
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 48 · Color for Print & Materials ──────────────────────────────────── */

export function ColorPrint() {
  const printable = BRAND_COLORS.filter((c) => c.group !== "status");
  return (
    <Chapter
      n={48}
      lead={
        <p>
          Screens mix light; printers mix ink. The same HEX value looks different on coated paper, on
          uncoated paper and on fabric — so print colors are matched on a physical proof, every time.
        </p>
      }
      toc={[
        { id: "values", title: "Print values" },
        { id: "black", title: "Printing black" },
        { id: "proof", title: "The proof rule" },
        { id: "materials-color", title: "Materials" },
      ]}
    >
      <Section id="values" title="Print values">
        <Table
          head={["Color", "HEX", "RGB", "CMYK — starting value"]}
          rows={printable.map((c) => [
            <span key="n" className="flex items-center gap-2"><span className="h-4 w-4 shrink-0 rounded shadow-[0_0_0_1px_rgba(0,0,0,0.15)]" style={{ background: c.hex }} />{c.name}</span>,
            <Code key="h">{c.hex}</Code>,
            rgbText(c.hex),
            cmykText(c.hex),
          ])}
        />
        <Note tone="warn">CMYK values here are calculated from the screen colors. They are a starting point for the printer, not a finished recipe: the final values are the ones that match the approved proof. Pantone references will be added once they are matched on press.</Note>
      </Section>

      <Section id="black" title="Printing black">
        <Specs rows={[
          ["Logo and text", "K100 only (C0 M0 Y0 K100) — sharp edges, no registration shift"],
          ["Large black areas", "Rich black C60 M40 Y40 K100 — deep and even"],
          ["Never", "Rich black on small text or thin lines; registration blur shows"],
          ["White logo on black", "A knock-out (unprinted paper), never white ink on black ink"],
        ]} />
      </Section>

      <Section id="proof" title="The proof rule">
        <Rule why="Paper, ink and press change the color. The only color that counts is the one on the real material.">
          No KOLEEX print job, sign or garment runs without a physical proof approved against the brand
          colors. Screen previews and PDFs are not proofs.
        </Rule>
        <Bullets items={[
          "Ask the printer for a hard proof on the final paper or material.",
          "Check it in daylight next to an approved KOLEEX sample.",
          "Record the approved values (and the printer) for the next run.",
        ]} />
      </Section>

      <Section id="materials-color" title="Materials">
        <Table
          head={["Material", "Black", "White", "Hub Blue"]}
          rows={[
            ["Coated paper", "K100 / rich black for areas", "Paper white", "CMYK starting value, proofed"],
            ["Uncoated paper", "K100", "Paper white", "Proofed — uncoated paper dulls blues"],
            ["Embroidery thread", "Black thread", "White thread", "Thread matched to an approved swatch"],
            ["Vinyl and signs", "Matte black vinyl", "White vinyl", "Vinyl matched to an approved swatch"],
            ["Screens", "#000000 / #0A0A0A", "#FFFFFF", "sRGB values from chapter 45"],
          ]}
        />
      </Section>
    </Chapter>
  );
}

/* ── 49 · Contrast & Legibility ────────────────────────────────────────── */

const PAIRS: Array<[string, string, string]> = [
  ["#000000", "#FFFFFF", "Black on White"],
  ["#1A1A1A", "#FFFFFF", "Graphite on White"],
  ["#4B5563", "#FFFFFF", "Slate on White"],
  ["#9CA3AF", "#FFFFFF", "Silver on White"],
  ["#3E6796", "#FFFFFF", "Deep on White"],
  ["#567FB2", "#FFFFFF", "Steel on White"],
  ["#FFFFFF", "#0A0A0A", "White on Ink"],
  ["#9CA3AF", "#0A0A0A", "Silver on Ink"],
  ["#7FA9D6", "#0A0A0A", "Sky on Ink"],
  ["#FFFFFF", "#3E6796", "White on Deep"],
  ["#FFFFFF", "#567FB2", "White on Steel"],
  ["#0A0A0A", "#BCD8F0", "Ink on Ice"],
];

function suitableFor(ratio: number): string {
  if (ratio >= 4.5) return "Any text";
  if (ratio >= 3) return "Large text (24 px+ / 18 pt+) and graphics only";
  return "Decoration and hairlines only — never text";
}

export function Contrast() {
  return (
    <Chapter
      n={49}
      lead={
        <p>
          Our readers use phones in bright workshops, print quotations on office printers and read signs
          across exhibition halls. Every text-and-background pair below has been measured; use the ones that
          pass for the job.
        </p>
      }
      toc={[
        { id: "standard", title: "The standard" },
        { id: "pairs", title: "Measured pairs" },
        { id: "sizes", title: "Minimum text sizes" },
      ]}
    >
      <Section id="standard" title="The standard">
        <Rule why="4.5 : 1 is the international accessibility standard (WCAG AA). It is also simply what people can read in poor light.">
          Text has a contrast of at least <B>4.5 : 1</B> with its background. Large text (24 px / 18 pt and
          above) and graphics need at least <B>3 : 1</B>.
        </Rule>
      </Section>

      <Section id="pairs" title="Measured pairs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PAIRS.map(([fg, bg, name]) => {
            const r = contrast(fg, bg);
            const g = grade(r);
            return (
              <div key={name} className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <Stage bg={bg} h={96} pad={16} style={{ borderRadius: 0 }}>
                  <p className="text-[17px] font-semibold" style={{ color: fg }}>Lockstitch 5,000 SPM</p>
                </Stage>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-[var(--text-primary)]">{name}</p>
                    <span
                      className="rounded-full px-2 py-[1px] font-mono text-[11px] font-semibold text-white"
                      style={{ background: g === "Fail" ? "#DC2626" : g === "AA Large" ? "#D97706" : "#059669" }}
                    >
                      {ratioText(r)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--text-dim)]">{suitableFor(r)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="sizes" title="Minimum text sizes">
        <Specs rows={[
          ["Screens — body text", "14 px (16 px on phones for long reading)"],
          ["Screens — smallest text", "12 px, weight 400 or heavier"],
          ["Print — body text", "9 pt"],
          ["Print — smallest text (legal lines, footnotes)", "6.5 pt, weight 400 or heavier"],
          ["Signs", "Letter height ≥ 25 mm per 10 m of reading distance"],
        ]} />
        <Note>Light weights (300 and below) are never used for text under 24 px — they break up in print and on low-quality screens.</Note>
      </Section>
    </Chapter>
  );
}
