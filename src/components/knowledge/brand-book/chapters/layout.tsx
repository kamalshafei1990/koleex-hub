"use client";

/* Chapters 55–57: grid & layout, spacing & shapes, graphic elements. */

import type { ReactNode } from "react";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";

const BLUE = "#567FB2";

/** A page drawn to scale with its margins and columns overlaid. */
function GridSheet({ w, h, margin, cols, gutter, dark = false, label, children }: {
  w: number; h: number; margin: number; cols: number; gutter: number; dark?: boolean; label: string; children?: ReactNode;
}) {
  const inner = w - margin * 2;
  const colW = (inner - gutter * (cols - 1)) / cols;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={label}>
      <rect width={w} height={h} fill={dark ? "#0A0A0A" : "#FFFFFF"} stroke="rgba(0,0,0,0.12)" />
      {Array.from({ length: cols }).map((_, i) => (
        <rect key={i} x={margin + i * (colW + gutter)} y={margin} width={colW} height={h - margin * 2} fill={BLUE} fillOpacity={dark ? 0.22 : 0.12} />
      ))}
      <rect x={margin} y={margin} width={inner} height={h - margin * 2} fill="none" stroke={BLUE} strokeDasharray="6 5" strokeWidth={Math.max(1, w / 400)} />
      {children}
    </svg>
  );
}

/* ── 55 · Grid & Layout ────────────────────────────────────────────────── */

export function GridLayout() {
  return (
    <Chapter
      n={55}
      lead={
        <p>
          Every KOLEEX layout sits on a grid. The grid is why a quotation, a catalog page and a social post
          look like they come from the same company — even when three different people made them.
        </p>
      }
      toc={[
        { id: "principle", title: "The principle" },
        { id: "formats", title: "Grids for our formats" },
        { id: "composition", title: "Composition" },
        { id: "grid-donts", title: "What never to do" },
      ]}
    >
      <Section id="principle" title="The principle">
        <Rule why="A shared grid is invisible, but everyone feels it: edges line up, the eye knows where to go, and the page looks deliberate.">
          Margins first, then columns, then content. Every text block, image and logo starts on a column
          edge.
        </Rule>
      </Section>

      <Section id="formats" title="Grids for our formats">
        <Examples cols={3}>
          <Example caption={<><B>House document</B> · 210 × 270 mm · 12 columns</>} bg="#F5F5F5" h={250}>
            <div style={{ width: 150 }}>
              <GridSheet w={210} h={270} margin={12} cols={12} gutter={3} label="Document grid">
                <image href="/brand/koleex-logo-black.svg" x={12} y={14} width={45} height={6.7} />
              </GridSheet>
            </div>
          </Example>
          <Example caption={<><B>Social post</B> · 1080 × 1350 px · 6 columns</>} bg="#F5F5F5" h={250}>
            <div style={{ width: 150 }}>
              <GridSheet w={1080} h={1350} margin={72} cols={6} gutter={24} dark label="Social post grid">
                <image href="/brand/koleex-logo-white.svg" x={72} y={1350 - 72 - 33} width={220} height={33} />
              </GridSheet>
            </div>
          </Example>
          <Example caption={<><B>Presentation</B> · 1920 × 1080 px · 12 columns</>} bg="#F5F5F5" h={250}>
            <div style={{ width: 220 }}>
              <GridSheet w={1920} h={1080} margin={96} cols={12} gutter={24} label="Presentation grid">
                <image href="/brand/koleex-logo-black.svg" x={96} y={64} width={200} height={30} />
              </GridSheet>
            </div>
          </Example>
        </Examples>
        <Table
          head={["Format", "Size", "Margins", "Columns · gutter"]}
          rows={[
            [<B key="a">House document</B>, "210 × 270 mm", "12 mm", "12 · 3 mm"],
            [<B key="a">Poster</B>, "A2 420 × 594 mm", "30 mm", "6 · 10 mm"],
            [<B key="a">Social post</B>, "1080 × 1350 px", "72 px", "6 · 24 px"],
            [<B key="a">Story / reel cover</B>, "1080 × 1920 px", "72 px sides · 250 px top and bottom", "4 · 24 px"],
            [<B key="a">Presentation</B>, "1920 × 1080 px", "96 px", "12 · 24 px"],
            [<B key="a">Website</B>, "Up to 1440 px content", "24 px (16 px on phones)", "12 · 24 px (4 on phones)"],
            [<B key="a">Business card</B>, "90 × 54 mm", "5 mm", "—"],
            [<B key="a">Roll-up banner</B>, "850 × 2000 mm", "60 mm · keep the bottom 200 mm empty", "6 · 20 mm"],
          ]}
        />
      </Section>

      <Section id="composition" title="Composition">
        <Bullets items={[
          <><B>One focal point</B> per layout — a product, a number or a headline. Everything else supports it.</>,
          <><B>Space is part of the design.</B> Leave at least a third of a marketing layout empty.</>,
          <><B>Start-aligned.</B> Left in English and Chinese, right in Arabic (<Ref n={54} />). Center only short titles on covers.</>,
          <><B>Group what belongs together</B> — a spec and its value, a photo and its caption — and separate groups with space, not boxes.</>,
        ]} />
        <Examples cols={2}>
          <Example tone="do" caption="Aligned to the grid, one focal point, space to breathe." bg="#F5F5F5" h={230}>
            <div className="relative h-[200px] w-[160px] rounded bg-[#0A0A0A] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
              <p className="text-[6px] tracking-[0.2em] text-[#7FA9D6]">CUTTING</p>
              <p className="mt-2 text-[15px] font-bold leading-tight text-white">Cut every<br />layer clean.</p>
              <div className="mt-3 h-16 rounded bg-[#1A1A1A]" />
              <div className="absolute bottom-4 left-4"><Wordmark color="#FFFFFF" width={48} /></div>
            </div>
          </Example>
          <Example tone="dont" caption="Nothing lines up, three focal points fight, no space left." bg="#F5F5F5" h={230}>
            <div className="relative h-[200px] w-[160px] overflow-hidden rounded bg-[#0A0A0A] shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
              <p className="absolute left-6 top-2 text-[6px] tracking-[0.2em] text-[#7FA9D6]">CUTTING</p>
              <p className="absolute right-2 top-7 text-right text-[13px] font-bold leading-tight text-white">Cut every<br />layer clean!</p>
              <div className="absolute left-2 top-16 h-14 w-20 rounded bg-[#1A1A1A]" />
              <p className="absolute left-3 top-[118px] text-[14px] font-black text-[#DC2626]">SALE</p>
              <p className="absolute right-3 top-[130px] text-[9px] text-white">Call now</p>
              <div className="absolute bottom-3 right-10"><Wordmark color="#FFFFFF" width={44} /></div>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="grid-donts" title="What never to do">
        <Bullets items={[
          "Place elements by eye without a grid.",
          "Change margins from page to page within one document or series.",
          "Fill every empty area — empty space is not wasted space.",
          "Let text run edge to edge on a phone screen: keep the margins.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 56 · Spacing & Shapes ─────────────────────────────────────────────── */

const SPACES = [4, 8, 12, 16, 24, 32, 48, 64, 96];
const RADII: Array<[number | "full", string]> = [[4, "Tags, small badges"], [8, "Buttons, inputs"], [12, "Cards, document blocks, controls"], [16, "Large cards, popups"], [24, "Hero panels"], ["full", "Chips, toggles, avatars only"]];

export function SpacingShapes() {
  return (
    <Chapter
      n={56}
      lead={
        <p>
          A small set of spaces, a small set of corner radii and a single hairline. Used every time, they
          give KOLEEX its calm, engineered look.
        </p>
      }
      toc={[
        { id: "spacing", title: "Spacing scale" },
        { id: "radii", title: "Corner radii" },
        { id: "lines", title: "Lines" },
        { id: "shapes", title: "Shapes" },
        { id: "depth", title: "Depth" },
      ]}
    >
      <Section id="spacing" title="Spacing scale">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="w-full space-y-2">
            {SPACES.map((s) => (
              <div key={s} className="flex items-center gap-4">
                <span className="w-16 shrink-0 font-mono text-[11px] text-[#4B5563]">{s} px</span>
                <span className="h-3 rounded-sm" style={{ width: s * 2, background: BLUE }} />
              </div>
            ))}
          </div>
        </Stage>
        <Specs rows={[
          ["Screen", "4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 px — nothing in between"],
          ["Print", "1 · 2 · 3 · 4 · 6 · 8 · 12 · 16 · 24 mm"],
          ["Inside a component", "Small steps: 4–16"],
          ["Between sections", "Large steps: 32–96"],
        ]} />
      </Section>

      <Section id="radii" title="Corner radii">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="flex w-full flex-wrap gap-5">
            {RADII.map(([r, use]) => (
              <div key={String(r)} className="flex w-[118px] flex-col gap-2">
                <div className="h-16 w-full border-2 border-[#0A0A0A]" style={{ borderRadius: r === "full" ? 999 : r }} />
                <span className="font-mono text-[11px] text-[#0A0A0A]">{r === "full" ? "full" : `${r} px`}</span>
                <span className="text-[11px] leading-4 text-[#4B5563]">{use}</span>
              </div>
            ))}
          </div>
        </Stage>
        <Note>In print, 12 px ≈ 3 mm. House documents use 12 px blocks throughout (<Ref n={94} />).</Note>
      </Section>

      <Section id="lines" title="Lines">
        <Specs rows={[
          ["Hairline", "1 px on screen · 0.25 pt in print — dividers, table rules, borders"],
          ["Rule", "2 px · 0.75 pt — under a section title, the Hub line"],
          ["Color on light", "Mist #E5E7EB (borders) · Ink #0A0A0A (strong rules)"],
          ["Color on dark", "White at 8–16% · Silver #9CA3AF"],
          ["Never", "Dashed or dotted decoration, double lines, shadows under lines"],
        ]} />
      </Section>

      <Section id="shapes" title="Shapes">
        <Rule why="Geometry reads as engineering. Organic shapes, splashes and blobs read as a different kind of company.">
          Rectangles with our radii, circles for avatars and status dots, straight lines. No blobs, waves,
          splashes, brush strokes or hand-drawn shapes.
        </Rule>
        <Note>The slow wave behind the Koleex Hub interface is part of the Hub’s Aurora skin only (<Ref n={77} />). It is never used on company material.</Note>
      </Section>

      <Section id="depth" title="Depth">
        <Examples cols={3}>
          <Example tone="do" caption="Separation by a hairline or a change of tone." bg="#F5F5F5" h={140}>
            <div className="w-40 rounded-xl border border-[#E5E7EB] bg-white p-3 text-[11px] text-[#0A0A0A]">Spec sheet<div className="mt-2 h-1.5 w-24 rounded bg-[#E5E7EB]" /></div>
          </Example>
          <Example tone="dont" caption="Heavy drop shadows on print and marketing." bg="#F5F5F5" h={140}>
            <div className="w-40 rounded-xl bg-white p-3 text-[11px] text-[#0A0A0A]" style={{ boxShadow: "8px 12px 18px rgba(0,0,0,0.45)" }}>Spec sheet<div className="mt-2 h-1.5 w-24 rounded bg-[#E5E7EB]" /></div>
          </Example>
          <Example tone="dont" caption="Bevels, embossing, 3D effects." bg="#F5F5F5" h={140}>
            <div className="w-40 rounded-xl p-3 text-[11px] font-bold text-[#4B5563]" style={{ background: "linear-gradient(180deg,#FFFFFF,#9CA3AF)", boxShadow: "inset 2px 2px 0 #fff, inset -3px -3px 0 #4B5563" }}>Spec sheet</div>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 57 · Graphic Elements ─────────────────────────────────────────────── */

/** The peak — the triangle that closes the X of the logo, at its exact proportions. */
export function Peak({ size = 24, color = "#0A0A0A" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 81.19 36.31" style={{ width: size, height: (size * 36.31) / 81.19 }} aria-hidden>
      <path d="M40.59,0 L81.19,36.31 H0 Z" fill={color} />
    </svg>
  );
}

export function GraphicElements() {
  return (
    <Chapter
      n={57}
      lead={
        <p>
          KOLEEX layouts are built from a very small kit: lines, the Hub line, the peak, labels and numbers.
          Each has one job. Nothing is added for decoration alone.
        </p>
      }
      toc={[
        { id: "kit", title: "The kit" },
        { id: "hub-line", title: "The Hub line" },
        { id: "peak", title: "The peak" },
        { id: "labels", title: "Labels and badges" },
        { id: "numbers", title: "Number callouts" },
        { id: "ge-donts", title: "What never to do" },
      ]}
    >
      <Section id="kit" title="The kit">
        <Table
          head={["Element", "Job"]}
          rows={[
            [<B key="a">Hairlines</B>, "Separate and align. The quietest structure there is."],
            [<B key="a">The Hub line</B>, "Finish a layout with a thin line of the Hub gradient — the one touch of color."],
            [<B key="a">The peak</B>, "Point to something that matters: a key spec, a section start, a highlight."],
            [<B key="a">Labels and badges</B>, "Name a category or a state: OVERLOCK, NEW, UPDATED."],
            [<B key="a">Number callouts</B>, "Make one number the hero: 70+ countries, since 1955."],
          ]}
        />
      </Section>

      <Section id="hub-line" title="The Hub line">
        <Examples cols={2}>
          <Example tone="do" caption="At the foot of a cover, full width, 3 px." bg="#0A0A0A" h={180} pad={0}>
            <div className="relative flex h-[180px] w-full items-center justify-center">
              <Wordmark color="#FFFFFF" width={170} />
              <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }} />
            </div>
          </Example>
          <Example tone="do" caption="Under a title, the width of the first word or less." bg="#FFFFFF" h={180}>
            <div>
              <p className="text-[24px] font-bold text-[#0A0A0A]">Spreading</p>
              <div className="mt-2 h-[3px] w-20" style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }} />
            </div>
          </Example>
        </Examples>
        <Specs rows={[
          ["Thickness", "2–4 px on screen · 0.75–1 pt in print"],
          ["Gradient", "#567FB2 → #BCD8F0, left to right"],
          ["How many", "One per layout"],
        ]} />
      </Section>

      <Section id="peak" title="The peak">
        <Stage bg="#FFFFFF" h="auto" pad={28}>
          <div className="flex w-full flex-wrap items-center gap-10">
            <div className="flex flex-col items-start gap-2">
              <Wordmark color="#000000" width={260} />
              <span className="text-[11px] text-[#4B5563]">The triangle that closes the X…</span>
            </div>
            <div className="flex flex-col items-start gap-2">
              <Peak size={80} />
              <span className="text-[11px] text-[#4B5563]">…is the peak, at the same proportions.</span>
            </div>
          </div>
        </Stage>
        <P>The peak marks what matters. It is used small and sparingly — a pointer, never a pattern.</P>
        <Examples cols={3}>
          <Example tone="do" caption="Marking the key spec on a spec sheet." bg="#FFFFFF" h={150}>
            <div className="w-full max-w-[220px] space-y-2 text-[12px] text-[#0A0A0A]">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-1.5"><span>Voltage</span><span className="font-mono">220 V</span></div>
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-1.5"><span className="flex items-center gap-1.5"><Peak size={10} color="#567FB2" />Motor</span><span className="font-mono">Direct drive</span></div>
              <div className="flex items-center justify-between"><span>Power</span><span className="font-mono">550 W</span></div>
            </div>
          </Example>
          <Example tone="do" caption="Opening a section in a catalog." bg="#FFFFFF" h={150}>
            <div className="flex items-center gap-2"><Peak size={16} /><span className="text-[18px] font-bold text-[#0A0A0A]">Overlock</span></div>
          </Example>
          <Example tone="dont" caption="Repeated as a pattern, rotated or enlarged into a background." bg="#FFFFFF" h={150}>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} style={{ transform: `rotate(${i * 36}deg)` }}><Peak size={20} color="#9CA3AF" /></span>
              ))}
            </div>
          </Example>
        </Examples>
        <Specs rows={[
          ["Shape", "Isosceles triangle, width : height = 81.19 : 36.31 — taken from the logo, never redrawn"],
          ["Direction", "Pointing up"],
          ["Size", "Capital height of the text beside it, or smaller"],
          ["Color", "Black, white or Hub Blue Steel"],
        ]} />
      </Section>

      <Section id="labels" title="Labels and badges">
        <Stage bg="#FFFFFF" h="auto" pad={24}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#4B5563]">Overlock · Series</span>
            <span className="rounded-md bg-[#0A0A0A] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">New</span>
            <span className="rounded-md border border-[#0A0A0A] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0A0A0A]">Updated</span>
            <span className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white" style={{ background: "#3E6796" }}>In the Hub</span>
          </div>
        </Stage>
        <Specs rows={[
          ["Type", "Inter SemiBold, capitals, +0.14 to +0.2 em"],
          ["Shape", "4–6 px radius; solid black, outlined, or Hub Blue Deep"],
          ["Words", "One or two words. A badge never makes a claim (no \"BEST\", no \"No. 1\")"],
        ]} />
      </Section>

      <Section id="numbers" title="Number callouts">
        <Examples cols={2}>
          <Example tone="do" caption="One number, one label, lots of space." bg="#0A0A0A" h={180}>
            <div className="flex gap-10 text-white">
              <div><p className="text-[44px] font-bold leading-none tracking-tight">70+</p><p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">Countries</p></div>
              <div><p className="text-[44px] font-bold leading-none tracking-tight">1955</p><p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">Where it began</p></div>
            </div>
          </Example>
          <Example tone="dont" caption="Unverified or meaningless numbers." bg="#0A0A0A" h={180}>
            <div className="text-white"><p className="text-[40px] font-bold leading-none">99.9%</p><p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#9CA3AF]">Customer satisfaction</p></div>
          </Example>
        </Examples>
        <Note tone="warn">Every number KOLEEX publishes must be true and checkable. If you cannot say where a number comes from, do not publish it (<Ref n={132} />).</Note>
      </Section>

      <Section id="ge-donts" title="What never to do">
        <Bullets items={[
          "Decorative patterns, textures or background graphics.",
          "Emoji or clip-art as graphic elements.",
          "More than one Hub line in a layout.",
          "Glows, neon, lens flares, light streaks.",
        ]} />
      </Section>
    </Chapter>
  );
}
