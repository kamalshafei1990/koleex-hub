"use client";

/* Chapters 55–57: grid & layout, spacing & shapes, graphic elements.

   Owner decisions (27/09/2026): generous space; corners 20–28 px; a
   centered hero with the headline on top and the machine below; no Hub
   line and no peak — the kit is type, space, silver and the machine. */

import type { ReactNode } from "react";
import { SILVER } from "@/lib/brand-book/tokens";
import {
  B, Bullets, Chapter, Example, Examples, Note, P, Ref, Rule, Section, Specs, Stage, Table,
} from "../kit";
import { Wordmark } from "../marks";
import { MachineShot } from "../mockups";

const GUIDE = "#8E8E93";

/** A page drawn to scale with its margins and columns overlaid. */
function GridSheet({ w, h, margin, cols, gutter, dark = false, label, children }: {
  w: number; h: number; margin: number; cols: number; gutter: number; dark?: boolean; label: string; children?: ReactNode;
}) {
  const inner = w - margin * 2;
  const colW = (inner - gutter * (cols - 1)) / cols;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={label}>
      <rect width={w} height={h} fill={dark ? "#000000" : "#FFFFFF"} stroke="rgba(0,0,0,0.12)" />
      {Array.from({ length: cols }).map((_, i) => (
        <rect key={i} x={margin + i * (colW + gutter)} y={margin} width={colW} height={h - margin * 2} fill={GUIDE} fillOpacity={dark ? 0.22 : 0.14} />
      ))}
      <rect x={margin} y={margin} width={inner} height={h - margin * 2} fill="none" stroke={GUIDE} strokeDasharray="6 5" strokeWidth={Math.max(1, w / 400)} />
      {children}
    </svg>
  );
}

function SilverHeadline({ children, size }: { children: ReactNode; size: number }) {
  return (
    <span className="font-semibold tracking-[-0.03em]" style={{ fontSize: size, lineHeight: 1.05, backgroundImage: SILVER.cssText, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{children}</span>
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
          <Example caption={<><B>House document</B> · 210 × 270 mm · 12 columns</>} bg="#F5F5F7" h={250}>
            <div style={{ width: 150 }}>
              <GridSheet w={210} h={270} margin={12} cols={12} gutter={3} label="Document grid">
                <image href="/brand/koleex-logo-black.svg" x={12} y={14} width={45} height={6.7} />
              </GridSheet>
            </div>
          </Example>
          <Example caption={<><B>Social post</B> · 1080 × 1350 px · 6 columns</>} bg="#F5F5F7" h={250}>
            <div style={{ width: 150 }}>
              <GridSheet w={1080} h={1350} margin={72} cols={6} gutter={24} dark label="Social post grid">
                <image href="/brand/koleex-logo-white.svg" x={72} y={1350 - 72 - 33} width={220} height={33} />
              </GridSheet>
            </div>
          </Example>
          <Example caption={<><B>Presentation</B> · 1920 × 1080 px · 12 columns</>} bg="#F5F5F7" h={250}>
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
          <><B>One focal point</B> — the machine, a number or a headline. Everything else supports it.</>,
          <><B>Space is the design.</B> Leave about half of a marketing layout empty.</>,
          <><B>Heroes are centered</B>: headline on top, the machine below. Longer text is start-aligned (<Ref n={54} />).</>,
          <><B>Group by space, not boxes</B> — a spec and its value, a photo and its caption.</>,
        ]} />
        <Examples cols={2}>
          <Example tone="do" caption="Centered, one focal point, room to breathe." bg="#F5F5F7" h={260}>
            <div className="flex h-[230px] w-[184px] flex-col items-center rounded-[14px] bg-black px-4 pt-6 text-center">
              <SilverHeadline size={20}>Cut every layer clean.</SilverHeadline>
              <div className="mt-auto w-full pb-4"><MachineShot w="100%" label={false} /></div>
            </div>
          </Example>
          <Example tone="dont" caption="Nothing lines up, three focal points fight, no space left." bg="#F5F5F7" h={260}>
            <div className="relative h-[230px] w-[184px] overflow-hidden rounded-[14px] bg-black">
              <p className="absolute left-6 top-2 text-[7px] tracking-[0.2em] text-[#98989D]">CUTTING</p>
              <p className="absolute right-2 top-7 text-right text-[14px] font-bold leading-tight text-white">Cut every<br />layer clean!</p>
              <div className="absolute left-2 top-16 h-14 w-20 rounded bg-[#1D1D1F]" />
              <p className="absolute left-3 top-[128px] text-[15px] font-black text-[#DC2626]">SALE</p>
              <p className="absolute right-3 top-[140px] text-[10px] text-white">Call now</p>
              <div className="absolute bottom-3 right-10"><Wordmark color="#FFFFFF" width={48} /></div>
            </div>
          </Example>
        </Examples>
      </Section>

      <Section id="grid-donts" title="What never to do">
        <Bullets items={[
          "Place elements by eye without a grid.",
          "Change margins from page to page within one document or series.",
          "Fill every empty area — empty space is what makes it premium.",
          "Let text run edge to edge on a phone screen: keep the margins.",
        ]} />
      </Section>
    </Chapter>
  );
}

/* ── 56 · Spacing & Shapes ─────────────────────────────────────────────── */

const SPACES = [8, 16, 24, 32, 48, 64, 96, 128, 160];
const RADII: Array<[number | "full", string]> = [[12, "Small tiles, inputs, tags"], [20, "Cards and panels"], [28, "Heroes and large panels"], ["full", "Buttons, chips, avatars"]];

export function SpacingShapes() {
  return (
    <Chapter
      n={56}
      lead={<p>Generous space, soft corners, one hairline. That is the whole shape language.</p>}
      toc={[
        { id: "spacing", title: "Spacing scale" },
        { id: "radii", title: "Corners" },
        { id: "lines", title: "Lines" },
        { id: "shapes", title: "Shapes" },
        { id: "depth", title: "Depth" },
      ]}
    >
      <Section id="spacing" title="Spacing scale">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="w-full space-y-2.5">
            {SPACES.map((s) => (
              <div key={s} className="flex items-center gap-4">
                <span className="w-16 shrink-0 font-mono text-[12px] text-[#6E6E73]">{s} px</span>
                <span className="h-3 rounded-full bg-[#1D1D1F]" style={{ width: s * 2 }} />
              </div>
            ))}
          </div>
        </Stage>
        <Specs rows={[
          ["Screen", "8 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160 px — nothing in between"],
          ["Inside a component", "8–32"],
          ["Between sections", "96–160 — more than feels necessary"],
          ["Print", "2 · 4 · 6 · 8 · 12 · 16 · 24 · 32 mm"],
        ]} />
      </Section>

      <Section id="radii" title="Corners">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="flex w-full flex-wrap gap-6">
            {RADII.map(([r, use]) => (
              <div key={String(r)} className="flex w-[140px] flex-col gap-2">
                <div className="h-20 w-full bg-[#F5F5F7] shadow-[inset_0_0_0_1px_#D2D2D7]" style={{ borderRadius: r === "full" ? 999 : r }} />
                <span className="font-mono text-[12px] text-[#1D1D1F]">{r === "full" ? "full" : `${r} px`}</span>
                <span className="text-[12px] leading-4 text-[#6E6E73]">{use}</span>
              </div>
            ))}
          </div>
        </Stage>
        <Note>In print, 20 px ≈ 5 mm. House documents keep their own 12 px blocks (<Ref n={94} />).</Note>
      </Section>

      <Section id="lines" title="Lines">
        <Specs rows={[
          ["Hairline", "1 px on screen · 0.25 pt in print — dividers and table rules only"],
          ["On white", "Mist #D2D2D7"],
          ["On black", "#38383A"],
          ["Never", "Decorative lines, underlines under headlines, dashed or double lines"],
        ]} />
      </Section>

      <Section id="shapes" title="Shapes">
        <Rule why="Geometry reads as engineering. Blobs, waves and splashes read as a different kind of company.">
          Rounded rectangles, circles for avatars and status dots — nothing else.
        </Rule>
        <Note>The slow wave behind the Koleex Hub interface belongs to the Hub’s Aurora skin only (<Ref n={77} />).</Note>
      </Section>

      <Section id="depth" title="Depth">
        <Examples cols={3}>
          <Example tone="do" caption="Separation by a change of tone." bg="#FFFFFF" h={150}>
            <div className="w-44 rounded-[20px] bg-[#F5F5F7] p-4 text-[13px] font-semibold text-[#1D1D1F]">Spec sheet<div className="mt-2 h-1.5 w-24 rounded-full bg-[#D2D2D7]" /></div>
          </Example>
          <Example tone="dont" caption="Heavy drop shadows." bg="#FFFFFF" h={150}>
            <div className="w-44 rounded-[20px] bg-white p-4 text-[13px] font-semibold text-[#1D1D1F]" style={{ boxShadow: "8px 12px 18px rgba(0,0,0,0.45)" }}>Spec sheet</div>
          </Example>
          <Example tone="dont" caption="Bevels, embossing, 3D." bg="#FFFFFF" h={150}>
            <div className="w-44 rounded-[20px] p-4 text-[13px] font-bold text-[#6E6E73]" style={{ background: "linear-gradient(180deg,#FFFFFF,#98989D)", boxShadow: "inset 2px 2px 0 #fff, inset -3px -3px 0 #6E6E73" }}>Spec sheet</div>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}

/* ── 57 · Graphic Elements ─────────────────────────────────────────────── */

export function GraphicElements() {
  return (
    <Chapter
      n={57}
      lead={<p>KOLEEX adds nothing for decoration. The whole kit is four things: type, space, silver and the machine.</p>}
      toc={[
        { id: "kit", title: "The kit" },
        { id: "numbers", title: "Big numbers" },
        { id: "labels", title: "Labels" },
        { id: "ge-donts", title: "What never to do" },
      ]}
    >
      <Section id="kit" title="The kit">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stage bg="#000000" h={200} pad={24}><SilverHeadline size={34}>Type.</SilverHeadline></Stage>
          <Stage bg="#FFFFFF" h={200} pad={24}><span className="text-[13px] text-[#6E6E73]">Space.</span></Stage>
          <Stage bg="#000000" h={200} pad={24}><div className="h-[72px] w-[200px] rounded-[18px]" style={{ background: SILVER.css }} /></Stage>
          <Stage bg="#000000" h={200} pad={24}><MachineShot w={240} label={false} /></Stage>
        </div>
        <Table
          head={["Element", "Its job"]}
          rows={[
            [<B key="a">Type</B>, "Big, short headlines carry the message (ch. 51)"],
            [<B key="a">Space</B>, "Makes everything look precise and premium"],
            [<B key="a">Silver</B>, "The one premium touch — headlines on black, the machine, metal (ch. 46)"],
            [<B key="a">The machine</B>, "Always the hero — our own studio photographs (ch. 63)"],
          ]}
        />
      </Section>

      <Section id="numbers" title="Big numbers">
        <Stage bg="#000000" h="auto" pad={48}>
          <div className="grid w-full grid-cols-3 gap-6 text-center">
            {[["1955", "since"], ["70+", "countries"], ["6,000", "stitches a minute"]].map(([n, l]) => (
              <div key={n}><SilverHeadline size={48}>{n}</SilverHeadline><p className="mt-2 text-[13px] text-[#98989D]">{l}</p></div>
            ))}
          </div>
        </Stage>
        <P>One number, huge, says more than a chart. Numbers come from Koleex Hub or have a source (<Ref n={132} />).</P>
      </Section>

      <Section id="labels" title="Labels">
        <Stage bg="#FFFFFF" h="auto" pad={32}>
          <div className="text-[#1D1D1F]">
            <p className="text-[15px] font-semibold text-[#6E6E73]">New · Overlock</p>
            <p className="mt-1 text-[34px] font-semibold tracking-[-0.025em]">Four threads. One pass.</p>
          </div>
        </Stage>
        <Specs rows={[
          ["Style", "Sentence case, SemiBold, Gray — above the headline"],
          ["Color", "Gray #6E6E73 on white, #98989D on black — never Hub Blue or a status color"],
          ["Never", "Letter-spaced capitals, colored pills, badges and stickers"],
        ]} />
      </Section>

      <Section id="ge-donts" title="What never to do">
        <Examples cols={3}>
          <Example tone="dont" caption="Decorative lines and underlines." bg="#000000" h={150}>
            <div className="text-center"><p className="text-[20px] font-semibold text-white">Quiet power.</p><span className="mx-auto mt-2 block h-[2px] w-16" style={{ background: "linear-gradient(90deg,#567FB2,#BCD8F0)" }} /></div>
          </Example>
          <Example tone="dont" caption="Triangles, patterns or shapes cut from the logo." bg="#000000" h={150}>
            <svg viewBox="0 0 81.19 36.31" style={{ width: 120 }} aria-hidden><path d="M40.59,0 L81.19,36.31 H0 Z" fill="#48484A" /></svg>
          </Example>
          <Example tone="dont" caption="Stickers, bursts and badges." bg="#000000" h={150}>
            <span className="rotate-[-12deg] rounded-full bg-[#DC2626] px-4 py-2 text-[14px] font-black text-white">NEW!</span>
          </Example>
        </Examples>
      </Section>
    </Chapter>
  );
}
